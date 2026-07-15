import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// LEGACY MODULE — the app sells exclusively through Google Play Billing now
// (see convex/googlePlayBilling.ts). The Stripe webhook route and checkout
// actions were removed with the Play migration.
//
// What intentionally remains here:
//   - refreshYearlySubscribers: payment-provider-agnostic cron that grants
//     yearly subscribers their monthly 300 credits (works on the shared
//     `subscriptions` table, so it covers Google Play yearly plans).
//   - Read-only queries kept for backward compatibility with older installed
//     app versions that still call them on startup.
// ---------------------------------------------------------------------------

const SUBSCRIPTION_CREDITS = 300;
const MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Cron: refresh monthly credits for active yearly subscribers.
// Yearly plans only bill once a year, so without this cron yearly users would
// not get the advertised 300 credits/month. Runs daily; for each active yearly
// sub whose lastCreditRefresh is ≥30 days old, resets credits to 300
// (purchased pack credits untouched).
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
// Read-only compatibility queries (older installed clients still call these).
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
