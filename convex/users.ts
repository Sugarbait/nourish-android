import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Get the current authenticated user's info from the users table (OAuth data). */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: (user as any).name ?? null,
      email: (user as any).email ?? null,
      image: (user as any).image ?? null,
    };
  },
});

/** Get the current user's profile (creates defaults if missing). */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    // Return defaults if profile not yet created
    if (!profile) {
      const user = await ctx.db.get(userId);
      return {
        userId,
        email: (user as any)?.email ?? "",
        name: (user as any)?.name ?? "",
        calorieGoal: 2200,
        proteinGoal: 150,
        carbsGoal: 250,
        fatGoal: 70,
        waterGoal: 8,
        dietaryRestrictions: "",
      };
    }
    return profile;
  },
});

/** Upsert user profile (goals, name, etc.) */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    calorieGoal: v.optional(v.number()),
    proteinGoal: v.optional(v.number()),
    carbsGoal: v.optional(v.number()),
    fatGoal: v.optional(v.number()),
    waterGoal: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const email = (user as any)?.email ?? "";

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("profiles", {
        userId,
        email,
        calorieGoal: args.calorieGoal ?? 2200,
        proteinGoal: args.proteinGoal ?? 150,
        carbsGoal: args.carbsGoal ?? 250,
        fatGoal: args.fatGoal ?? 70,
        waterGoal: args.waterGoal ?? 8,
        name: args.name,
        dietaryRestrictions: args.dietaryRestrictions,
      });
    }
  },
});

/** Ensure credits row exists for the user, resetting daily frees if needed. */
export const getCredits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const today = todayKey();

    if (!credits) {
      return {
        mealCredits: 0,
        aiCredits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      };
    }

    // Reset daily frees if it's a new day
    if (credits.lastFreeDate !== today) {
      return { ...credits, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    return credits;
  },
});

export const consumeMealCredit = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = todayKey();
    let credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    // Ensure row exists
    if (!credits) {
      const id = await ctx.db.insert("credits", {
        userId,
        mealCredits: 0,
        aiCredits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
      credits = await ctx.db.get(id) as any;
    }

    // Reset daily if new day
    if (credits!.lastFreeDate !== today) {
      await ctx.db.patch(credits!._id, { lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false });
      credits = { ...credits!, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    if (!credits!.dailyFreeMealUsed) {
      await ctx.db.patch(credits!._id, { dailyFreeMealUsed: true });
      return { success: true };
    }
    if (credits!.mealCredits > 0) {
      await ctx.db.patch(credits!._id, { mealCredits: credits!.mealCredits - 1 });
      return { success: true };
    }
    return { success: false };
  },
});

export const consumeAICredit = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = todayKey();
    let credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!credits) {
      const id = await ctx.db.insert("credits", {
        userId,
        mealCredits: 0,
        aiCredits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
      credits = await ctx.db.get(id) as any;
    }

    if (credits!.lastFreeDate !== today) {
      await ctx.db.patch(credits!._id, { lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false });
      credits = { ...credits!, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    if (!credits!.dailyFreeAIUsed) {
      await ctx.db.patch(credits!._id, { dailyFreeAIUsed: true });
      return { success: true };
    }
    if (credits!.aiCredits > 0) {
      await ctx.db.patch(credits!._id, { aiCredits: credits!.aiCredits - 1 });
      return { success: true };
    }
    return { success: false };
  },
});

export const addCredits = mutation({
  args: {
    mealCredits: v.optional(v.number()),
    aiCredits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = todayKey();
    let credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!credits) {
      await ctx.db.insert("credits", {
        userId,
        mealCredits: args.mealCredits ?? 0,
        aiCredits: args.aiCredits ?? 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    } else {
      await ctx.db.patch(credits._id, {
        mealCredits: credits.mealCredits + (args.mealCredits ?? 0),
        aiCredits: credits.aiCredits + (args.aiCredits ?? 0),
      });
    }
  },
});
