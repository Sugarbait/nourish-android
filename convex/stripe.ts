import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Maps Stripe amount_total (cents) → credits to award
const AMOUNT_TO_CREDITS: Record<number, number> = {
  199: 100,  // $1.99 Starter
  499: 300,  // $4.99 Value
  999: 800,  // $9.99 Pro
};

const SUBSCRIPTION_CREDITS = 40;

// ---------------------------------------------------------------------------
// Helper: resolve a Convex userId (string from client_reference_id) or fall
// back to looking up by email.
// ---------------------------------------------------------------------------
async function resolveUserId(
  ctx: any,
  userId: string,
  email: string
): Promise<Id<"users"> | null> {
  // Primary: direct document lookup (userId is a Convex Id string)
  if (userId) {
    try {
      const user = await ctx.db.get(userId as Id<"users">);
      if (user) return user._id;
    } catch { /* invalid id format — fall through */ }
  }
  // Fallback: lookup by email
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
export const activateSubscription = mutation({
  args: {
    userId: v.string(),
    customerEmail: v.string(),
  },
  handler: async (ctx, { userId, customerEmail }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[stripe] User not found:", { userId, customerEmail });
      return;
    }

    // Upsert subscription row
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { active: true, plan: "monthly", expiresAt: expiry });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: uid,
        plan: "monthly",
        active: true,
        expiresAt: expiry,
      });
    }

    // Add 40 credits to the credits pool
    const today = new Date().toISOString().slice(0, 10);
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", uid))
      .first();

    if (credits) {
      await ctx.db.patch(credits._id, {
        mealCredits: credits.mealCredits + SUBSCRIPTION_CREDITS,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        mealCredits: SUBSCRIPTION_CREDITS,
        aiCredits: 0,
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
export const addCreditPack = mutation({
  args: {
    userId: v.string(),
    customerEmail: v.string(),
    amountTotal: v.number(), // Stripe amount in cents, e.g. 199
  },
  handler: async (ctx, { userId, customerEmail, amountTotal }) => {
    const uid = await resolveUserId(ctx, userId, customerEmail);
    if (!uid) {
      console.error("[stripe] User not found:", { userId, customerEmail });
      return;
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
      await ctx.db.patch(credits._id, {
        mealCredits: credits.mealCredits + amount,
      });
    } else {
      await ctx.db.insert("credits", {
        userId: uid,
        mealCredits: amount,
        aiCredits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Query: get subscription state for a user (called on checkout success)
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
// Query: get credits for a user (called on checkout success to sync localStorage)
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
