import { v } from "convex/values";
import { internalMutation, internalQuery, query, action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
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
    /** Play purchase token — used to make the credit grant idempotent. */
    purchaseToken: v.optional(v.string()),
    /** Google's authoritative expiryTime (ms). Falls back to now + period. */
    expiresAtMs: v.optional(v.number()),
  },
  handler: async (ctx, { userId, customerEmail, tier, purchaseToken, expiresAtMs }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[googlePlayBilling] User not found:", { userId, customerEmail });
      return;
    }

    const now = Date.now();
    const expiry = expiresAtMs && expiresAtMs > now
      ? expiresAtMs
      : now + SUBSCRIPTION_BASE_PLANS[tier as SubscriptionTier].periodMs;

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    // Idempotency: if we've already processed this exact purchase token, refresh
    // the subscription window but DON'T grant the monthly credits again. This
    // prevents duplicate purchase events (e.g. the plugin re-emitting `approved`)
    // from double-crediting the account.
    const alreadyGranted = !!purchaseToken && existing?.lastPurchaseToken === purchaseToken;

    if (existing) {
      const patch: Record<string, unknown> = {
        active: true,
        plan: tier,
        expiresAt: expiry,
        lastPurchaseToken: purchaseToken ?? existing.lastPurchaseToken,
      };
      // Only bump the credit-refresh clock when credits are actually granted —
      // otherwise duplicate purchase events would keep pushing the yearly
      // cron's 30-day refresh window into the future without ever granting.
      if (!alreadyGranted) patch.lastCreditRefresh = now;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("subscriptions", {
        userId: uid,
        plan: tier,
        active: true,
        expiresAt: expiry,
        lastCreditRefresh: now,
        lastPurchaseToken: purchaseToken,
      });
    }

    if (alreadyGranted) {
      console.log("[googlePlayBilling] Skipping duplicate credit grant for token:", purchaseToken?.slice(0, 12));
      return;
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
// Auth: mint a short-lived access token for the Play Developer API.
//
// We reuse the existing Google OAuth client (the gcloud client behind
// GOOGLE_CLIENT_ID/SECRET) plus a dedicated refresh token, GOOGLE_PLAY_REFRESH_TOKEN,
// that was minted with the `androidpublisher` scope. This is a separate token
// from GOOGLE_REFRESH_TOKEN (Vertex AI) so the two never interfere.
//
// The refresh is a single OAuth POST — no google-auth-library / "use node"
// needed, so this file keeps its mutations + queries in the default runtime.
// ---------------------------------------------------------------------------
async function getPlayAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_PLAY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Play OAuth credentials not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[googlePlayBilling] token refresh failed:", res.status, body.slice(0, 300));
    throw new Error("Failed to obtain Google Play access token");
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in token response");
  return data.access_token as string;
}

/** Headers for an authorized Play Developer API call (incl. quota project). */
function playApiHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  // User-credential calls to non-cloud-platform APIs need a quota project for
  // billing/quota attribution — the GCP project linked to the Play Console.
  const quotaProject = process.env.GOOGLE_PROJECT_ID;
  if (quotaProject) headers["x-goog-user-project"] = quotaProject;
  return headers;
}

// ---------------------------------------------------------------------------
// Validate a Play purchase token with the Google Play Developer API.
// Returns the resolved purchase info (kind, sku, basePlanId/tier). Shared by
// the read-only `validatePurchaseToken` action (useful for debugging) and the
// `validateAndGrant` action that actually credits the account.
//
// We never trust the client's claim — a tampered client could otherwise claim
// free credits. Everything is checked against Google before granting.
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

async function verifyPurchaseWithGoogle(args: {
  productId: string;
  purchaseToken: string;
  basePlanId?: string;
}): Promise<ValidationResult> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) {
    return { success: false, error: "Google Play package name not configured" };
  }

  let accessToken: string;
  try {
    accessToken = await getPlayAccessToken();
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Auth failed" };
  }

  const headers = playApiHeaders(accessToken);
  const isSubscription = isSubscriptionProductId(args.productId);

  try {
    if (isSubscription) {
      // subscriptionsv2 returns base-plan info under lineItems[].offerDetails
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${args.purchaseToken}`;
      const response = await fetch(url, { method: "GET", headers });
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

      return { success: true, kind: "subscription", productId: args.productId, tier, basePlanId, expiresAtMs };
    } else {
      // One-time consumable: /purchases/products/{sku}/tokens/{token}
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${args.productId}/tokens/${args.purchaseToken}`;
      const response = await fetch(url, { method: "GET", headers });
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

      return { success: true, kind: "consumable", productId: args.productId, credits };
    }
  } catch (error: any) {
    console.error("[googlePlayBilling] Validation error:", error?.message);
    return { success: false, error: error?.message ?? "Validation error" };
  }
}

/** Read-only validation (no state change). Handy for debugging / manual checks. */
export const validatePurchaseToken = action({
  args: {
    productId: v.string(),
    purchaseToken: v.string(),
    basePlanId: v.optional(v.string()),
    userId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<ValidationResult> => {
    return verifyPurchaseWithGoogle(args);
  },
});

// ---------------------------------------------------------------------------
// Validate a purchase AND grant the entitlement in one round-trip. This is the
// action the client calls from the cordova-plugin-purchase `approved` callback.
// On success the client should call transaction.finish() (consume on Android).
// ---------------------------------------------------------------------------
export const validateAndGrant = action({
  args: {
    productId: v.string(),
    purchaseToken: v.string(),
    basePlanId: v.optional(v.string()),
    userId: v.string(),
    customerEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; kind?: "subscription" | "consumable" }> => {
    const result = await verifyPurchaseWithGoogle({
      productId: args.productId,
      purchaseToken: args.purchaseToken,
      basePlanId: args.basePlanId,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (result.kind === "subscription") {
      await ctx.runMutation(internal.googlePlayBilling.activateSubscription, {
        userId: args.userId,
        customerEmail: args.customerEmail,
        tier: result.tier,
        purchaseToken: args.purchaseToken,
        expiresAtMs: result.expiresAtMs || undefined,
      });
      return { success: true, kind: "subscription" };
    } else {
      await ctx.runMutation(internal.googlePlayBilling.addCreditPack, {
        userId: args.userId,
        customerEmail: args.customerEmail,
        productId: result.productId,
      });
      return { success: true, kind: "consumable" };
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

// ===========================================================================
// Subscription reconciliation
//
// Google Play does NOT notify this backend when a subscription renews, lapses,
// or is cancelled (we have no RTDN endpoint). Renewals keep the SAME purchase
// token, so the client never re-triggers a grant either. Without this job a
// monthly subscriber would lose Pro 30 days after purchase while Google keeps
// charging them, and would never receive their monthly 300 credits.
//
// A cron therefore re-validates the stored purchase token of every
// subscription that is near/past its recorded expiry:
//   - still entitled  → extend expiresAt to Google's authoritative expiryTime,
//                       and when a new billing period started, reset
//                       subscription credits to 300 (pack credits untouched)
//   - no longer entitled (expired / on hold / paused / refunded) → deactivate
// ===========================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
/** Re-check active subs this close to (or past) their recorded expiry. */
const RECONCILE_HORIZON_MS = 12 * 60 * 60 * 1000;
/** Keep re-checking lapsed subs this long — covers Play's 30-day account hold. */
const REACTIVATION_WINDOW_MS = 35 * DAY_MS;
/** A renewal must advance expiry by more than this (real periods are ≥28 days). */
const MIN_RENEWAL_ADVANCE_MS = 7 * DAY_MS;
/** Never grant renewal credits twice within this window (idempotency belt). */
const MIN_MS_BETWEEN_CREDIT_GRANTS = 20 * DAY_MS;

export const listPlaySubsForReconcile = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const subs = await ctx.db.query("subscriptions").collect();
    return subs
      .filter((s) => !!s.lastPurchaseToken)
      .filter((s) => {
        const exp = s.expiresAt ?? 0;
        // Active: only bother Google when the recorded window is about to end.
        if (s.active) return exp < now + RECONCILE_HORIZON_MS;
        // Inactive: keep checking for a while — the user may fix their payment
        // method (grace/hold) and Google will resume the subscription.
        return exp > now - REACTIVATION_WINDOW_MS;
      })
      .map((s) => ({
        subId: s._id,
        userId: s.userId,
        purchaseToken: s.lastPurchaseToken as string,
        expiresAt: s.expiresAt ?? 0,
        lastCreditRefresh: s.lastCreditRefresh ?? 0,
        active: s.active,
      }));
  },
});

export const applyPlayReconcile = internalMutation({
  args: {
    subId: v.id("subscriptions"),
    userId: v.id("users"),
    entitled: v.boolean(),
    plan: v.optional(v.union(v.literal("monthly"), v.literal("yearly"))),
    expiresAt: v.optional(v.number()),
    grantRenewalCredits: v.boolean(),
  },
  handler: async (ctx, { subId, userId, entitled, plan, expiresAt, grantRenewalCredits }) => {
    const sub = await ctx.db.get(subId);
    if (!sub) return;

    if (!entitled) {
      if (sub.active) await ctx.db.patch(subId, { active: false });
      return;
    }

    const patch: Record<string, unknown> = { active: true };
    if (plan) patch.plan = plan;
    if (expiresAt) patch.expiresAt = expiresAt;
    if (grantRenewalCredits) patch.lastCreditRefresh = Date.now();
    await ctx.db.patch(subId, patch);

    if (grantRenewalCredits) {
      // Renewal semantics match stripe.renewSubscription / the yearly cron:
      // subscription credits RESET to the monthly allotment; purchased pack
      // credits are never touched.
      const credits = await ctx.db
        .query("credits")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
      if (credits) {
        await ctx.db.patch(credits._id, {
          credits: SUBSCRIPTION_MONTHLY_CREDITS,
          mealCredits: undefined,
          aiCredits: undefined,
        });
      } else {
        await ctx.db.insert("credits", {
          userId,
          credits: SUBSCRIPTION_MONTHLY_CREDITS,
          lastFreeDate: new Date().toISOString().slice(0, 10),
          dailyFreeMealUsed: false,
          dailyFreeAIUsed: false,
        });
      }
    }
  },
});

/** Fetch the live state of a Play subscription token from Google. */
async function fetchPlaySubscriptionState(purchaseToken: string): Promise<
  | { ok: true; state: string; expiryMs: number; basePlanId: string | null }
  | { ok: false; gone: boolean; error: string }
> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) return { ok: false, gone: false, error: "GOOGLE_PLAY_PACKAGE_NAME not configured" };

  let accessToken: string;
  try {
    accessToken = await getPlayAccessToken();
  } catch (e: any) {
    return { ok: false, gone: false, error: e?.message ?? "auth failed" };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: playApiHeaders(accessToken) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[googlePlayBilling] reconcile fetch failed:", res.status, body.slice(0, 200));
    // 400/404/410 mean Google no longer recognizes the token (expired long ago,
    // refunded, or revoked). Anything else (401/403/5xx) is transient — retry
    // on the next run rather than touching the subscription.
    return { ok: false, gone: res.status === 400 || res.status === 404 || res.status === 410, error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  const lineItem = data.lineItems?.[0];
  return {
    ok: true,
    state: data.subscriptionState ?? "UNKNOWN",
    expiryMs: lineItem?.expiryTime ? new Date(lineItem.expiryTime).getTime() : 0,
    basePlanId: lineItem?.offerDetails?.basePlanId ?? null,
  };
}

export const reconcilePlaySubscriptions = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ checked: number; renewed: number; deactivated: number; reactivated: number; errors: number }> => {
    const subs: Array<{
      subId: Id<"subscriptions">;
      userId: Id<"users">;
      purchaseToken: string;
      expiresAt: number;
      lastCreditRefresh: number;
      active: boolean;
    }> = await ctx.runQuery(internal.googlePlayBilling.listPlaySubsForReconcile, {});

    // Fetch all states first so a systemic failure (bad config, Play outage)
    // can be detected before we deactivate anyone.
    const results = await Promise.all(
      subs.map(async (sub) => ({ sub, res: await fetchPlaySubscriptionState(sub.purchaseToken) })),
    );

    // Circuit breaker: if EVERY checked token comes back "gone", something is
    // wrong with our config (e.g. package name) — don't mass-deactivate.
    const goneCount = results.filter(({ res }) => !res.ok && res.gone).length;
    if (subs.length >= 3 && goneCount === subs.length) {
      console.error("[googlePlayBilling] reconcile aborted: all", subs.length, "tokens reported gone — suspected config error.");
      return { checked: subs.length, renewed: 0, deactivated: 0, reactivated: 0, errors: subs.length };
    }

    let renewed = 0, deactivated = 0, reactivated = 0, errors = 0;
    const now = Date.now();

    for (const { sub, res } of results) {
      if (!res.ok) {
        if (res.gone) {
          await ctx.runMutation(internal.googlePlayBilling.applyPlayReconcile, {
            subId: sub.subId, userId: sub.userId, entitled: false, grantRenewalCredits: false,
          });
          if (sub.active) deactivated++;
        } else {
          errors++;
        }
        continue;
      }

      // CANCELED keeps entitlement until the period the user already paid for
      // runs out; ON_HOLD / PAUSED / EXPIRED do not.
      const entitled =
        res.state === "SUBSCRIPTION_STATE_ACTIVE" ||
        res.state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
        (res.state === "SUBSCRIPTION_STATE_CANCELED" && res.expiryMs > now);

      if (!entitled) {
        await ctx.runMutation(internal.googlePlayBilling.applyPlayReconcile, {
          subId: sub.subId, userId: sub.userId, entitled: false, grantRenewalCredits: false,
        });
        if (sub.active) deactivated++;
        continue;
      }

      const tier = res.basePlanId ? getSubscriptionTierFromBasePlanId(res.basePlanId) : null;
      // A renewal moved Google's expiry a full period past what we recorded.
      const renewalHappened = res.expiryMs > sub.expiresAt + MIN_RENEWAL_ADVANCE_MS;
      const grantDue = renewalHappened && now - sub.lastCreditRefresh > MIN_MS_BETWEEN_CREDIT_GRANTS;

      await ctx.runMutation(internal.googlePlayBilling.applyPlayReconcile, {
        subId: sub.subId,
        userId: sub.userId,
        entitled: true,
        plan: tier ?? undefined,
        expiresAt: res.expiryMs || undefined,
        grantRenewalCredits: grantDue,
      });
      if (!sub.active) reactivated++;
      if (grantDue) renewed++;
    }

    console.log(
      `[googlePlayBilling] reconcile: checked=${subs.length} renewed=${renewed} deactivated=${deactivated} reactivated=${reactivated} errors=${errors}`,
    );
    return { checked: subs.length, renewed, deactivated, reactivated, errors };
  },
});
