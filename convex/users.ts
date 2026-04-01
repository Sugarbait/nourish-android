import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Get user info by userId. */
export const getCurrentUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  },
});

/** Get the user's profile (creates defaults if missing). */
export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const user = await ctx.db.get(userId);
      return {
        userId,
        email: user?.email ?? "",
        name: user?.name ?? "",
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
    userId: v.id("users"),
    name: v.optional(v.string()),
    calorieGoal: v.optional(v.number()),
    proteinGoal: v.optional(v.number()),
    carbsGoal: v.optional(v.number()),
    fatGoal: v.optional(v.number()),
    waterGoal: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...rest } = args;
    const user = await ctx.db.get(userId);
    const email = user?.email ?? "";

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, rest);
    } else {
      await ctx.db.insert("profiles", {
        userId,
        email,
        calorieGoal: rest.calorieGoal ?? 2200,
        proteinGoal: rest.proteinGoal ?? 150,
        carbsGoal: rest.carbsGoal ?? 250,
        fatGoal: rest.fatGoal ?? 70,
        waterGoal: rest.waterGoal ?? 8,
        name: rest.name,
        dietaryRestrictions: rest.dietaryRestrictions,
      });
    }
  },
});

/** Get credits for user (returns defaults if no row yet). */
export const getCredits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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

    if (credits.lastFreeDate !== today) {
      return { ...credits, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    return credits;
  },
});

export const consumeMealCredit = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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
    userId: v.id("users"),
    mealCredits: v.optional(v.number()),
    aiCredits: v.optional(v.number()),
  },
  handler: async (ctx, { userId, mealCredits, aiCredits }) => {
    const today = todayKey();
    let credits = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!credits) {
      await ctx.db.insert("credits", {
        userId,
        mealCredits: mealCredits ?? 0,
        aiCredits: aiCredits ?? 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    } else {
      await ctx.db.patch(credits._id, {
        mealCredits: credits.mealCredits + (mealCredits ?? 0),
        aiCredits: credits.aiCredits + (aiCredits ?? 0),
      });
    }
  },
});
