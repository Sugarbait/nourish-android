/**
 * Single source of truth for Google Play Billing products.
 *
 * Mirrors what is configured in Play Console for this app. Both the frontend
 * (lib/googlePlayBilling.ts, components/pricing-modal.tsx) AND the backend
 * (convex/googlePlayBilling.ts) import from here so SKUs / credit amounts
 * cannot drift between layers.
 *
 * This file is intentionally pure: no Capacitor, no Convex, no Node imports.
 * It is safe to consume from any runtime.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Subscription: ONE product in Play Console (`premium_membership`) with TWO
// base plans (`premium-monthly`, `premium-yearly`). When initiating a purchase
// the client orders the product + selects the base plan / offer.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PRODUCT_ID = 'premium_membership';

export const SUBSCRIPTION_BASE_PLAN_IDS = {
  monthly: 'premium-monthly',
  yearly:  'premium-yearly',
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_BASE_PLAN_IDS;

export const SUBSCRIPTION_BASE_PLANS: Record<
  SubscriptionTier,
  {
    basePlanId: string;
    priceUsd: number;
    periodMs: number;
    label: string;
  }
> = {
  monthly: { basePlanId: SUBSCRIPTION_BASE_PLAN_IDS.monthly, priceUsd:  8.99, periodMs:  30 * DAY_MS, label: 'Monthly Pro' },
  yearly:  { basePlanId: SUBSCRIPTION_BASE_PLAN_IDS.yearly,  priceUsd: 79.99, periodMs: 365 * DAY_MS, label: 'Yearly Pro'  },
};

/** Credits granted on subscription activation / monthly renewal. */
export const SUBSCRIPTION_MONTHLY_CREDITS = 300;

// ---------------------------------------------------------------------------
// One-time consumable credit packs. SKU strings here MUST match Play Console.
// ---------------------------------------------------------------------------

export const CREDIT_PACK_SKUS = [
  'credits_pack_50',
  'credits_pack_150',
  'credits_pack_400',
] as const;

export type CreditPackSku = typeof CREDIT_PACK_SKUS[number];

/** UI grouping key used by pricing-modal + lib/credits.ts CREDIT_PACKAGES. */
export type CreditPackUiKey = 'starter' | 'value' | 'pro';

export const CREDIT_PACKS: Record<
  CreditPackSku,
  {
    credits: number;
    priceUsd: number;
    name: string;
    uiKey: CreditPackUiKey;
  }
> = {
  credits_pack_50:  { credits:  50, priceUsd:  1.99, name: 'Starter Top Pack', uiKey: 'starter' },
  credits_pack_150: { credits: 150, priceUsd:  4.99, name: 'Value Pack',       uiKey: 'value'   },
  credits_pack_400: { credits: 400, priceUsd: 12.99, name: 'Pro Pack',         uiKey: 'pro'     },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isCreditPackSku(sku: string): sku is CreditPackSku {
  return (CREDIT_PACK_SKUS as readonly string[]).includes(sku);
}

export function isSubscriptionProductId(productId: string): boolean {
  return productId === SUBSCRIPTION_PRODUCT_ID;
}

export function getCreditsForSku(sku: string): number {
  return isCreditPackSku(sku) ? CREDIT_PACKS[sku].credits : 0;
}

export function getSubscriptionTierFromBasePlanId(basePlanId: string): SubscriptionTier | null {
  if (basePlanId === SUBSCRIPTION_BASE_PLAN_IDS.monthly) return 'monthly';
  if (basePlanId === SUBSCRIPTION_BASE_PLAN_IDS.yearly)  return 'yearly';
  return null;
}

export function getSkuForUiKey(uiKey: CreditPackUiKey): CreditPackSku {
  const sku = (CREDIT_PACK_SKUS as readonly CreditPackSku[]).find(
    (s) => CREDIT_PACKS[s].uiKey === uiKey,
  );
  if (!sku) throw new Error(`No SKU mapped for UI key "${uiKey}"`);
  return sku;
}
