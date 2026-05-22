/**
 * Google Play Billing — frontend service.
 *
 * SKUs, credit amounts, and subscription periods live in `lib/billingConfig.ts`
 * (the single source of truth shared with Convex). This file is the runtime
 * engine that drives `cordova-plugin-purchase` (CdvPurchase v13) on Android:
 * it registers products, launches the native purchase flow, and on approval
 * validates + grants the entitlement through the Convex `validateAndGrant`
 * action before finishing (consuming) the transaction.
 *
 * It is only functional inside the native Android app (Capacitor). On the web
 * it degrades gracefully — `launchPurchaseFlow` returns an error outcome.
 */

import { Capacitor } from '@capacitor/core';
import {
  SUBSCRIPTION_PRODUCT_ID,
  SUBSCRIPTION_BASE_PLAN_IDS,
  SUBSCRIPTION_BASE_PLANS,
  SUBSCRIPTION_MONTHLY_CREDITS,
  CREDIT_PACK_SKUS,
  CREDIT_PACKS,
  getCreditsForSku,
  isCreditPackSku,
  isSubscriptionProductId,
  getSubscriptionTierFromBasePlanId,
  type SubscriptionTier,
  type CreditPackSku,
} from './billingConfig';

export interface BillingConfig {
  /** All product IDs the store needs to register on init. */
  subscriptionIds: string[];
  inappIds: string[];
}

// Subscription is ONE product id (premium_membership) with multiple base plans —
// the base plan is selected at order time, not registered separately.
export const BILLING_CONFIG: BillingConfig = {
  subscriptionIds: [SUBSCRIPTION_PRODUCT_ID],
  inappIds: [...CREDIT_PACK_SKUS],
};

// Re-exports so callers don't have to reach into billingConfig directly.
export {
  SUBSCRIPTION_PRODUCT_ID,
  SUBSCRIPTION_BASE_PLAN_IDS,
  SUBSCRIPTION_BASE_PLANS,
  SUBSCRIPTION_MONTHLY_CREDITS,
  CREDIT_PACK_SKUS,
  CREDIT_PACKS,
  getCreditsForSku,
  isCreditPackSku,
  isSubscriptionProductId,
  getSubscriptionTierFromBasePlanId,
};
export type { SubscriptionTier, CreditPackSku };

/** Convenience for callers that need the period of a chosen tier. */
export function getSubscriptionPeriodMs(tier: SubscriptionTier): number {
  return SUBSCRIPTION_BASE_PLANS[tier].periodMs;
}

/** True if the product id is the subscription product. */
export function isSubscription(productId: string): boolean {
  return isSubscriptionProductId(productId);
}

/** True if the SKU is one of the consumable credit packs. */
export function isConsumable(productId: string): boolean {
  return isCreditPackSku(productId);
}

/** Credits for a product (0 for the subscription — its grant is fixed). */
export function getCreditsForProduct(productId: string): number {
  return getCreditsForSku(productId);
}

// ===========================================================================
// Runtime engine (cordova-plugin-purchase v13 / CdvPurchase)
// ===========================================================================

/** Outcome returned to a caller awaiting launchPurchaseFlow. */
export type PurchaseOutcome =
  | { status: 'completed'; kind: 'subscription' | 'consumable' }
  | { status: 'already_owned' }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

/**
 * Convex granter — bind from `useAction(api.googlePlayBilling.validateAndGrant)`
 * in a React component and pass it into `launchPurchaseFlow`. The lib stays
 * framework-agnostic; React owns the Convex client.
 */
export type ValidateAndGrant = (args: {
  productId: string;
  purchaseToken: string;
  basePlanId?: string;
  userId: string;
  customerEmail: string;
}) => Promise<{ success: boolean; error?: string; kind?: 'subscription' | 'consumable' }>;

// `window.CdvPurchase` — typed loosely; the plugin ships ambient types but we
// access it dynamically to keep this module safe to evaluate during SSR/build.
type StoreNS = any;

let _cdv: StoreNS | null = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;

// Context the global `approved` handler needs — refreshed on each launch.
let _granter: ValidateAndGrant | null = null;
let _user: { userId: string; customerEmail: string } | null = null;
let _onGranted: (() => void) | null = null;

// Correlates an in-flight order() with the transaction that gets approved.
interface Pending {
  productId: string;
  basePlanId?: string;
  settled: boolean;
  resolve: (o: PurchaseOutcome) => void;
}
let _pending: Pending | null = null;

// Guards against the plugin emitting `approved` more than once for the same
// transaction (which would otherwise validate + grant twice).
const _processingTxns = new Set<string>();
const _finishedTxns = new Set<string>();

// Synchronous lock so two fast taps can't each fire a Google Play order.
let _purchaseInFlight = false;

const PURCHASE_TIMEOUT_MS = 120_000;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Wait for the `window.CdvPurchase` global to appear. cordova-plugin-purchase is
 * a Cordova plugin; under Capacitor its JS is injected into the WebView via
 * `cap sync` and registers the global shortly after boot — so we poll briefly
 * rather than bundling the plugin into the web build.
 */
async function waitForCdvPurchase(timeoutMs = 10_000): Promise<StoreNS | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const g = (window as any).CdvPurchase;
    if (g) return g;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

/** True if billing is usable (native app + plugin loaded). */
export function isBillingAvailable(): boolean {
  return isNative() && typeof window !== 'undefined' && !!(window as any).CdvPurchase;
}

function settlePending(outcome: PurchaseOutcome): void {
  if (_pending && !_pending.settled) {
    _pending.settled = true;
    const p = _pending;
    _pending = null;
    p.resolve(outcome);
  }
}

/**
 * Google Play offer ids are built by the plugin as:
 *   `<productId>@<basePlanId>`            (a base plan, no promo offer)
 *   `<productId>@<basePlanId>@<offerId>`  (a promotional offer on a base plan)
 * So the base plan id is the SECOND `@`-segment.
 */
function deriveBasePlanId(offerId?: string): string | undefined {
  if (!offerId) return undefined;
  const parts = offerId.split('@');
  return parts[1] ?? parts[0];
}

/** Find the offer for a given base plan, preferring the plain base plan over any promo offer. */
function findOfferForBasePlan(product: any, basePlanId: string): any | undefined {
  const candidates = (product?.offers ?? []).filter(
    (o: any) => o?.id?.split('@')[1] === basePlanId,
  );
  // Prefer the plain base plan (2 segments) so we charge the standard recurring price.
  return candidates.find((o: any) => o.id.split('@').length === 2) ?? candidates[0];
}

function isCancelError(CdvPurchase: StoreNS, err: any): boolean {
  const cancelCode = CdvPurchase?.ErrorCode?.PAYMENT_CANCELLED;
  if (cancelCode != null && err?.code === cancelCode) return true;
  return typeof err?.message === 'string' && /cancel/i.test(err.message);
}

/**
 * Convert raw Google Play error codes to user-friendly messages.
 * This handles both error code strings (e.g. "BILLING_UNAVAILABLE") and message strings.
 */
function friendlyErrorMessage(rawError: any): string {
  const msg = rawError?.message || String(rawError || '');

  // Map common Google Play error codes/messages to friendly copy
  const errorMap: Record<string, string> = {
    'BILLING_UNAVAILABLE': 'Google Play Billing is not available on your device. Please make sure you have a valid Google Play account and try again.',
    'SERVICE_UNAVAILABLE': 'Google Play service is temporarily unavailable. Please try again in a moment.',
    'USER_CANCELED': 'Purchase was cancelled.',
    'ITEM_ALREADY_OWNED': 'You already own this subscription.',
    'ITEM_NOT_OWNED': 'Could not find this item in your account.',
    'DEVELOPER_ERROR': 'There was a configuration error. Please contact support.',
    'SERVICE_DISCONNECTED': 'Could not connect to Google Play. Please check your internet connection.',
    'FEATURE_NOT_SUPPORTED': 'This purchase method is not supported on your device.',
    'INVALID_ARGUMENTS': 'Invalid purchase request. Please try again.',
    'Could not start the purchase': 'Could not start the purchase. Please try again.',
    'NETWORK_ERROR': 'Network error. Please check your internet connection and try again.',
  };

  // Check if the message contains any of our known error codes
  for (const [key, friendly] of Object.entries(errorMap)) {
    if (msg.includes(key)) {
      return friendly;
    }
  }

  // Fallback: use original message if no match, or a generic message if empty
  return msg || 'An unexpected error occurred during the purchase. Please try again.';
}

/**
 * Handle an approved transaction: validate + grant via Convex, then finish
 * (which consumes a credit pack or acknowledges a subscription on Android).
 * We only finish AFTER a successful grant — a failed grant leaves the purchase
 * un-finished so Google can retry or auto-refund, never silently losing money.
 */
async function handleApproved(tx: any): Promise<void> {
  const productId: string = tx?.products?.[0]?.id ?? _pending?.productId ?? '';
  const offerId: string | undefined = tx?.products?.[0]?.offerId;
  const purchaseToken: string | undefined = tx?.purchaseToken ?? tx?.nativePurchase?.purchaseToken;

  // Dedup key: the purchase token is stable per purchase; fall back to txn id.
  const txnKey: string = purchaseToken ?? tx?.transactionId ?? '';

  // Already granted, or currently being processed — ignore the duplicate event.
  if (txnKey && (_finishedTxns.has(txnKey) || _processingTxns.has(txnKey))) {
    console.log('[GooglePlayBilling] Ignoring duplicate approved event for', txnKey.slice(0, 12));
    return;
  }
  if (txnKey) _processingTxns.add(txnKey);

  try {
    if (!purchaseToken) {
      console.warn('[GooglePlayBilling] approved transaction has no purchaseToken:', tx);
      settlePending({ status: 'error', error: 'Could not read purchase token.' });
      return;
    }

    if (!_granter || !_user?.userId) {
      console.warn('[GooglePlayBilling] approved transaction but no signed-in user/granter set.');
      settlePending({ status: 'error', error: 'You must be signed in to complete a purchase.' });
      return;
    }

    const basePlanId = deriveBasePlanId(offerId) ?? _pending?.basePlanId;

    const res = await _granter({
      productId,
      purchaseToken,
      basePlanId,
      userId: _user.userId,
      customerEmail: _user.customerEmail,
    });

    if (!res.success) {
      console.warn('[GooglePlayBilling] validateAndGrant failed:', res.error);
      settlePending({ status: 'error', error: res.error || 'Purchase validation failed.' });
      return; // leave un-finished for retry / refund
    }

    await tx.finish();
    if (txnKey) _finishedTxns.add(txnKey);
    _onGranted?.();
    settlePending({
      status: 'completed',
      kind: res.kind ?? (isSubscriptionProductId(productId) ? 'subscription' : 'consumable'),
    });
  } catch (e: any) {
    console.error('[GooglePlayBilling] handleApproved error:', e?.message);
    settlePending({ status: 'error', error: e?.message || 'Purchase processing error.' });
  } finally {
    if (txnKey) _processingTxns.delete(txnKey);
  }
}

/**
 * Initialize Google Play Billing once. Registers products, wires the approved
 * handler, and connects to the store. No-op on web. Safe to call repeatedly.
 */
export async function initializeBilling(): Promise<void> {
  if (!isNative()) {
    console.log('[GooglePlayBilling] Skipping init (not a native platform).');
    return;
  }
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const CdvPurchase = await waitForCdvPurchase();
    if (!CdvPurchase) {
      throw new Error('Google Play Billing is unavailable (cordova-plugin-purchase not loaded).');
    }
    _cdv = CdvPurchase;

    const { store, ProductType, Platform, LogLevel } = CdvPurchase;
    if (LogLevel) store.verbosity = LogLevel.WARNING;

    store.register([
      { id: SUBSCRIPTION_PRODUCT_ID, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY },
      ...CREDIT_PACK_SKUS.map((sku) => ({
        id: sku,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      })),
    ]);

    store.when().approved((tx: any) => { void handleApproved(tx); });

    await store.initialize([Platform.GOOGLE_PLAY]);
    _initialized = true;
    console.log('[GooglePlayBilling] Initialized with', BILLING_CONFIG);
  })();

  try {
    await _initPromise;
  } finally {
    _initPromise = null;
  }
}

/**
 * Launch the native purchase flow for a product and resolve once the purchase
 * is fully processed (validated + granted server-side and finished), cancelled,
 * or errored.
 *
 * @param opts.productId      Play product id (subscription product or credit-pack SKU)
 * @param opts.basePlanId     Required for subscriptions — selects the base plan / offer
 * @param opts.userId         Convex user id (for server-side grant)
 * @param opts.customerEmail  User email (fallback lookup on the backend)
 * @param opts.granter        Bound Convex validateAndGrant action
 * @param opts.onGranted      Optional callback fired after a successful grant
 */
export async function launchPurchaseFlow(opts: {
  productId: string;
  basePlanId?: string;
  userId: string;
  customerEmail: string;
  granter: ValidateAndGrant;
  onGranted?: () => void;
}): Promise<PurchaseOutcome> {
  if (!isNative()) {
    return { status: 'error', error: 'In-app purchases are only available in the Android app.' };
  }

  // Synchronous re-entrancy guard — set BEFORE any await so two fast taps can't
  // both reach offer.order() and create duplicate Google Play orders.
  if (_purchaseInFlight) {
    return { status: 'error', error: 'A purchase is already in progress. Please wait a moment.' };
  }
  _purchaseInFlight = true;

  try {
    try {
      await initializeBilling();
    } catch (e: any) {
      return { status: 'error', error: e?.message || 'Could not connect to Google Play.' };
    }

    const CdvPurchase = _cdv;
    if (!CdvPurchase) return { status: 'error', error: 'Google Play Billing is not available.' };
    const { store, Platform } = CdvPurchase;

    // Context for the global approved handler.
    _granter = opts.granter;
    _user = { userId: opts.userId, customerEmail: opts.customerEmail };
    _onGranted = opts.onGranted ?? null;

    const product = store.get(opts.productId, Platform.GOOGLE_PLAY);
    if (!product) {
      return {
        status: 'error',
        error: `Product "${opts.productId}" is unavailable. Make sure it is active in Play Console and the app was installed from a Play test track.`,
      };
    }

    // Guard against re-buying a subscription that's already owned (e.g. if local
    // state is briefly stale). The plugin marks owned products after restore.
    if (isSubscriptionProductId(opts.productId) && product.owned) {
      console.log('[GooglePlayBilling] subscription already owned — skipping re-purchase.');
      _onGranted?.();
      return { status: 'already_owned' };
    }

    // Diagnostic: log every offer the store loaded so we can confirm base-plan
    // matching on-device (visible in logcat under "GooglePlayBilling").
    console.log(
      '[GooglePlayBilling] offers for',
      opts.productId,
      (product.offers ?? []).map((o: any) => ({
        id: o.id,
        price: o.pricingPhases?.[o.pricingPhases.length - 1]?.price,
      })),
      '| requested basePlanId:',
      opts.basePlanId,
    );

    // Pick the offer. For subscriptions, match the requested base plan exactly.
    let offer: any | undefined;
    if (opts.basePlanId) {
      offer = findOfferForBasePlan(product, opts.basePlanId);
      if (!offer) {
        return {
          status: 'error',
          error: `Couldn't find the "${opts.basePlanId}" plan. Check that this base plan exists and is active in Play Console.`,
        };
      }
    } else {
      offer = product.getOffer?.() ?? product.offers?.[0];
    }
    if (!offer) {
      return { status: 'error', error: 'No purchasable offer found for this product.' };
    }
    console.log('[GooglePlayBilling] ordering offer:', offer.id);

    // Register the pending deferred BEFORE ordering — `approved` can fire fast.
    let resolveOutcome!: (o: PurchaseOutcome) => void;
    const outcome = new Promise<PurchaseOutcome>((resolve) => { resolveOutcome = resolve; });
    _pending = { productId: opts.productId, basePlanId: opts.basePlanId, settled: false, resolve: resolveOutcome };

    const orderError = await offer.order({ applicationUsername: opts.userId });
    if (orderError) {
      settlePending(
        isCancelError(CdvPurchase, orderError)
          ? { status: 'cancelled' }
          : { status: 'error', error: friendlyErrorMessage(orderError) },
      );
    }

    const timeout = new Promise<PurchaseOutcome>((resolve) =>
      setTimeout(
        () => resolve({ status: 'error', error: 'The purchase timed out. If you were charged, your account will update shortly.' }),
        PURCHASE_TIMEOUT_MS,
      ),
    );

    return await Promise.race([outcome, timeout]);
  } finally {
    _purchaseInFlight = false;
  }
}
