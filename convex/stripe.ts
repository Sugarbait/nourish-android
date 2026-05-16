import { v } from "convex/values";
import { mutation, internalMutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Maps Stripe amount_total (cents) → credits to award — must match CREDIT_PACKAGES in lib/credits.ts
const AMOUNT_TO_CREDITS: Record<number, number> = {
  199: 50,   // $1.99 Starter
  499: 150,  // $4.99 Value
  1299: 400,  // $12.99 Pro
};

const SUBSCRIPTION_CREDITS = 300;

const MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;
const YEARLY_MS  = 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helper: resolve a Convex userId (string from client_reference_id) or fall
// back to looking up by email.
// ---------------------------------------------------------------------------
async function resolveUserId(
  ctx: any,
  userId: string,
  email: string
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
// Called by webhook on checkout.session.completed with mode === 'subscription'
// ---------------------------------------------------------------------------
export const activateSubscription = internalMutation({
  args: {
    userId:           v.string(),
    customerEmail:    v.string(),
    stripeCustomerId: v.optional(v.string()),
    isYearly:         v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, customerEmail, stripeCustomerId, isYearly }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[stripe] User not found:", { userId, customerEmail });
      return;
    }

    // Save stripeCustomerId on the user row for future portal sessions
    if (stripeCustomerId) {
      await ctx.db.patch(uid, { stripeCustomerId });
    }

    // Upsert subscription row — yearly gets a 365-day window
    const plan   = isYearly ? "yearly" : "monthly";
    const expiry = Date.now() + (isYearly ? YEARLY_MS : MONTHLY_MS);

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { active: true, plan, expiresAt: expiry, lastCreditRefresh: now });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: uid,
        plan,
        active: true,
        expiresAt: expiry,
        lastCreditRefresh: now,
      });
    }

    // Add 300 subscription credits
    const today = new Date().toISOString().slice(0, 10);
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (credits) {
      let mappedCredits = credits.credits ?? ((credits.mealCredits ?? 0) + (credits.aiCredits ?? 0));
      await ctx.db.patch(credits._id, {
        credits: mappedCredits + SUBSCRIPTION_CREDITS,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        credits: SUBSCRIPTION_CREDITS,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Called by webhook on checkout.session.completed with mode === 'payment'
// ---------------------------------------------------------------------------
export const addCreditPack = internalMutation({
  args: {
    userId:           v.string(),
    customerEmail:    v.string(),
    amountTotal:      v.number(),
    stripeCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, customerEmail, amountTotal, stripeCustomerId }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[stripe] User not found:", { userId, customerEmail });
      return;
    }

    // Save stripeCustomerId if present
    if (stripeCustomerId) {
      await ctx.db.patch(uid, { stripeCustomerId });
    }

    const amount = AMOUNT_TO_CREDITS[amountTotal];
    if (!amount) {
      console.error("[stripe] Unknown amountTotal:", amountTotal);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (credits) {
      const existing = credits.purchasedCredits ?? 0;
      await ctx.db.patch(credits._id, {
        purchasedCredits: existing + amount,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        credits: 0,
        purchasedCredits: amount,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Called by webhook on invoice.payment_succeeded (billing_reason = subscription_cycle)
// Adds 300 renewal credits and extends expiry by 30 days (monthly) or 365 (yearly).
// ---------------------------------------------------------------------------
export const renewSubscription = internalMutation({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("stripeCustomerId"), stripeCustomerId))
      .first();

    if (!user) {
      console.error("[stripe] No user found for renewal, customerId:", stripeCustomerId);
      return;
    }

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    const isYearly = sub?.plan === "yearly";
    const expiry   = Date.now() + (isYearly ? YEARLY_MS : MONTHLY_MS);
    const plan     = isYearly ? "yearly" : "monthly";

    const now = Date.now();
    if (sub) {
      await ctx.db.patch(sub._id, { active: true, plan, expiresAt: expiry, lastCreditRefresh: now });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: user._id,
        plan,
        active: true,
        expiresAt: expiry,
        lastCreditRefresh: now,
      });
    }

    // Reset subscription credits to 300 — purchased pack credits are preserved
    const today = new Date().toISOString().slice(0, 10);
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    if (credits) {
      await ctx.db.patch(credits._id, {
        credits: SUBSCRIPTION_CREDITS,
        // purchasedCredits intentionally not touched — pack credits never expire
      });
    } else {
      await ctx.db.insert("credits", {
        userId: user._id,
        credits: SUBSCRIPTION_CREDITS,
        purchasedCredits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Called by webhook on customer.subscription.deleted (cancellation)
// ---------------------------------------------------------------------------
export const deactivateSubscription = internalMutation({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("stripeCustomerId"), stripeCustomerId))
      .first();

    if (!user) {
      console.error("[stripe] No user found for stripeCustomerId:", stripeCustomerId);
      return;
    }

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    if (sub) {
      await ctx.db.patch(sub._id, { active: false, plan: null });
    }
  },
});

// ---------------------------------------------------------------------------
// Query: get subscription state (called on checkout success)
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
// Query: get credits (called on checkout success to sync localStorage)
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

// ---------------------------------------------------------------------------
// Cron: refresh monthly credits for active yearly subscribers.
// Stripe only sends an invoice once per year for yearly plans, so without
// this cron yearly users would not get the advertised 300 credits/month.
// Runs daily; for each active yearly sub whose lastCreditRefresh is ≥30 days
// old, resets credits to 300 (purchased pack credits untouched).
// ---------------------------------------------------------------------------
export const refreshYearlySubscribers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - MONTHLY_MS;

    const yearlySubs = await ctx.db
      .query("subscriptions")
      .withIndex("by_active_plan", (q) => q.eq("active", true).eq("plan", "yearly"))
      .collect();

    let refreshed = 0;
    for (const sub of yearlySubs) {
      const last = sub.lastCreditRefresh ?? 0;
      if (last > cutoff) continue; // refreshed within last 30 days

      // Skip if subscription has actually expired
      if (sub.expiresAt && sub.expiresAt < now) continue;

      const credits = await ctx.db
        .query("credits")
        .withIndex("by_userId", (q: any) => q.eq("userId", sub.userId))
        .first();

      if (credits) {
        await ctx.db.patch(credits._id, { credits: SUBSCRIPTION_CREDITS });
      } else {
        const today = new Date().toISOString().slice(0, 10);
        await ctx.db.insert("credits", {
          userId: sub.userId,
          credits: SUBSCRIPTION_CREDITS,
          purchasedCredits: 0,
          lastFreeDate: today,
          dailyFreeMealUsed: false,
          dailyFreeAIUsed: false,
        });
      }

      await ctx.db.patch(sub._id, { lastCreditRefresh: now });
      refreshed++;
    }

    console.log("[stripe] Yearly credit refresh complete. Refreshed:", refreshed);
    return { refreshed };
  },
});

// ---------------------------------------------------------------------------
// Query: get the Stripe customer ID for a user (used to open billing portal)
// ---------------------------------------------------------------------------
export const getStripeCustomerId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;
    try {
      const user = await ctx.db.get(userId as Id<"users">);
      return user?.stripeCustomerId ?? null;
    } catch {
      return null;
    }
  },
});
