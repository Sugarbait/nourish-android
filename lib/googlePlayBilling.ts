/**
 * Google Play Billing — frontend service.
 *
 * SKUs, credit amounts, and subscription periods live in `lib/billingConfig.ts`
 * (the single source of truth shared with Convex). This file is a thin wrapper
 * that exposes the surface the rest of the frontend (pricing modal, future
 * cordova-plugin-purchase wiring) needs.
 */

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

export interface Product {
  id: string;
  type: 'subscription' | 'inapp';
  title: string;
  description: string;
  price: string;
  priceMicros: number;
  currency: string;
}

export interface Purchase {
  productId: string;
  basePlanId?: string;
  token: string;
  purchaseTime: number;
  purchaseState: 'purchased' | 'pending';
  orderId?: string;
}

export interface BillingConfig {
  /** All product IDs the store needs to register on init. */
  subscriptionIds: string[];
  inappIds: string[];
}

// Re-export the canonical config in the shape the legacy callers used.
// Subscription is now ONE product id (premium_membership) with multiple base
// plans — the base plan is selected at order time, not registered separately.
export const BILLING_CONFIG: BillingConfig = {
  subscriptionIds: [SUBSCRIPTION_PRODUCT_ID],
  inappIds: [...CREDIT_PACK_SKUS],
};

// Re-exports so existing callers don't have to change import path
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

/**
 * Initialize Google Play Billing.
 * Phase 1 placeholder — `cordova-plugin-purchase` registration happens in
 * Phase 2 when the real purchase flow is wired up.
 */
export async function initializeBilling(): Promise<void> {
  console.log('[GooglePlayBilling] Configured products:', BILLING_CONFIG);
}

/**
 * Launch a purchase flow.
 *
 * Phase 1 stub: throws so callers fail loud if they reach this path. Phase 2
 * will replace this with a real `cordova-plugin-purchase` order, including
 * passing `basePlanId` as the offer id for subscriptions and calling
 * `product.finish()` (consume on Android) in the approved callback.
 */
export async function launchPurchaseFlow(
  _productId: string,
  _options?: { basePlanId?: string },
): Promise<string | null> {
  throw new Error('Purchase flow not yet implemented (Phase 2).');
}

/**
 * Validate a purchase with the Convex backend.
 *
 * Phase 1 keeps the legacy `/api/validate-purchase` fetch path — Phase 2 will
 * call the Convex action directly so we don't depend on a Next.js API route
 * that doesn't exist in the static-export build.
 */
export async function validatePurchase(
  productId: string,
  purchaseToken: string,
  userId?: string,
  basePlanId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/validate-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, purchaseToken, userId, basePlanId }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Validation failed' };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** True if the product id is the subscription product. */
export function isSubscription(productId: string): boolean {
  return isSubscriptionProductId(productId);
}

/** True if the SKU is one of the consumable credit packs. */
export function isConsumable(productId: string): boolean {
  return isCreditPackSku(productId);
}

/**
 * Get credits for a product. Returns 0 for subscriptions (their credit grant
 * is `SUBSCRIPTION_MONTHLY_CREDITS`, not derived from the product id).
 */
export function getCreditsForProduct(productId: string): number {
  return getCreditsForSku(productId);
}
