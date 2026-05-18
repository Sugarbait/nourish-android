import { v } from "convex/values";
import { mutation, internalMutation, query, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  SUBSCRIPTION_MONTHLY_CREDITS,
  SUBSCRIPTION_BASE_PLANS,
  isSubscriptionProductId,
  getCreditsForSku,
  getSubscriptionTierFromBasePlanId,
  type SubscriptionTier,
} from "../lib/billingConfig";

// ---------------------------------------------------------------------------
// Helper: resolve a Convex userId (string) or fall back to looking up by email
// ---------------------------------------------------------------------------
async function resolveUserId(
  ctx: any,
  userId: string,
  email: string,
): Promise<Id<"users"> | null> {
  if (userId) {
    try {
      const user = await ctx.db.get(userId as Id<"users">);
      if (user) return user._id;
    } catch { /* invalid id format — fall through */ }
  }
  if (email) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();
    if (user) return user._id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Called after a subscription purchase token is validated with Google Play.
// Grants the user the subscription and the monthly credit allotment.
// Schema choice: `subscriptions.plan` stays "monthly" | "yearly" (mapped from
// the basePlanId returned by Google) — see SESSION_2026-05-17_NOTIFICATIONS.md
// and the Phase 1 plan for why we kept the existing enum.
// ---------------------------------------------------------------------------
export const activateSubscription = internalMutation({
  args: {
    userId: v.string(),
    customerEmail: v.string(),
    tier: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, { userId, customerEmail, tier }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[googlePlayBilling] User not found:", { userId, customerEmail });
      return;
    }

    const expiry = Date.now() + SUBSCRIPTION_BASE_PLANS[tier as SubscriptionTier].periodMs;
    const now = Date.now();

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { active: true, plan: tier, expiresAt: expiry, lastCreditRefresh: now });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: uid,
        plan: tier,
        active: true,
        expiresAt: expiry,
        lastCreditRefresh: now,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (credits) {
      const mappedCredits = credits.credits ?? ((credits.mealCredits ?? 0) + (credits.aiCredits ?? 0));
      await ctx.db.patch(credits._id, {
        credits: mappedCredits + SUBSCRIPTION_MONTHLY_CREDITS,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        credits: SUBSCRIPTION_MONTHLY_CREDITS,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Called after a one-time consumable purchase token is validated with Google Play.
// productId is the Play SKU (e.g. "credits_pack_50").
// ---------------------------------------------------------------------------
export const addCreditPack = internalMutation({
  args: {
    userId: v.string(),
    customerEmail: v.string(),
    productId: v.string(),
  },
  handler: async (ctx, { userId, customerEmail, productId }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[googlePlayBilling] User not found:", { userId, customerEmail });
      return;
    }

    const credits = getCreditsForSku(productId);
    if (!credits) {
      console.error("[googlePlayBilling] Unknown productId:", productId);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const creditRecord = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (creditRecord) {
      const existing = creditRecord.purchasedCredits ?? 0;
      await ctx.db.patch(creditRecord._id, {
        purchasedCredits: existing + credits,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        credits: 0,
        purchasedCredits: credits,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Validate a Play purchase token with the Google Play Developer API.
// Phase 1: this action no longer mutates state. It returns the resolved
// purchase info (kind, sku, basePlanId/tier) so the caller can decide what to
// grant. Phase 2 will wire this to call activateSubscription / addCreditPack
// directly and have the client call .finish() on the plugin after success.
//
// Auth note: the Play Developer API requires an OAuth bearer token issued to a
// service account with `androidpublisher` scope — NOT the user-OAuth refresh
// token used for Vertex AI. Until that service account is provisioned (Phase 2
// requirement), this action returns success:false with a configured-needed
// error when env vars are missing. We deliberately don't fall back to "trust
// the client" because that would let a tampered client claim free credits.
// ---------------------------------------------------------------------------
type ValidationResult =
  | {
      success: true;
      kind: "subscription";
      productId: string;
      tier: SubscriptionTier;
      basePlanId: string;
      expiresAtMs: number;
    }
  | {
      success: true;
      kind: "consumable";
      productId: string;
      credits: number;
    }
  | {
      success: false;
      error: string;
    };

export const validatePurchaseToken = action({
  args: {
    productId: v.string(),
    purchaseToken: v.string(),
    /** Required for subscriptions, ignored for consumables. */
    basePlanId: v.optional(v.string()),
    userId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<ValidationResult> => {
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    const playApiToken = process.env.GOOGLE_PLAY_API_TOKEN; // OAuth bearer from service account

    if (!packageName || !playApiToken) {
      return { success: false, error: "Google Play credentials not configured" };
    }

    const isSubscription = isSubscriptionProductId(args.productId);

    try {
      if (isSubscription) {
        // subscriptionsv2 returns base-plan info under lineItems[].offerDetails
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${args.purchaseToken}`;
        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${playApiToken}` },
        });
        if (!response.ok) {
          console.error("[googlePlayBilling] subscriptionsv2 error:", response.status, response.statusText);
          return { success: false, error: "Subscription validation failed" };
        }
        const data = await response.json();

        if (data.subscriptionState !== "SUBSCRIPTION_STATE_ACTIVE" &&
            data.subscriptionState !== "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") {
          return { success: false, error: `Subscription not active (${data.subscriptionState})` };
        }

        const lineItem = data.lineItems?.[0];
        const basePlanId: string | undefined = lineItem?.offerDetails?.basePlanId ?? args.basePlanId;
        if (!basePlanId) {
          return { success: false, error: "Could not determine base plan from purchase" };
        }
        const tier = getSubscriptionTierFromBasePlanId(basePlanId);
        if (!tier) {
          return { success: false, error: `Unknown base plan: ${basePlanId}` };
        }

        const expiresAtMs = lineItem?.expiryTime ? new Date(lineItem.expiryTime).getTime() : 0;

        return {
          success: true,
          kind: "subscription",
          productId: args.productId,
          tier,
          basePlanId,
          expiresAtMs,
        };
      } else {
        // One-time consumable: correct endpoint is /purchases/products/{sku}/tokens/{token}
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${args.productId}/tokens/${args.purchaseToken}`;
        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${playApiToken}` },
        });
        if (!response.ok) {
          console.error("[googlePlayBilling] products purchase error:", response.status, response.statusText);
          return { success: false, error: "Purchase validation failed" };
        }
        const data = await response.json();

        // purchaseState: 0 = Purchased, 1 = Cancelled, 2 = Pending
        if (data.purchaseState !== 0) {
          return { success: false, error: `Purchase not completed (state ${data.purchaseState})` };
        }

        const credits = getCreditsForSku(args.productId);
        if (!credits) {
          return { success: false, error: `Unknown product: ${args.productId}` };
        }

        return {
          success: true,
          kind: "consumable",
          productId: args.productId,
          credits,
        };
      }
    } catch (error: any) {
      console.error("[googlePlayBilling] Validation error:", error?.message);
      return { success: false, error: error?.message ?? "Validation error" };
    }
  },
});

// ---------------------------------------------------------------------------
// Query: get subscription state
// ---------------------------------------------------------------------------
export const getSubscription = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;
    try {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId as Id<"users">))
        .first();
      return sub ?? null;
    } catch {
      return null;
    }
  },
});

// ---------------------------------------------------------------------------
// Query: get credits for sync
// ---------------------------------------------------------------------------
export const getCreditsForSync = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;
    try {
      const credits = await ctx.db
        .query("credits")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId as Id<"users">))
        .first();
      return credits ?? null;
    } catch {
      return null;
    }
  },
});
