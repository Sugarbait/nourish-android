import { v, ConvexError } from "convex/values";
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

    const user = await ctx.db.get(userId);
    if (!profile) {
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
        age: "",
        weight: "",
        height: "",
        activityLevel: "moderate",
        avatar: user?.avatarUrl ?? "",
      };
    }
    return {
      ...profile,
      avatar: profile.avatar || user?.avatarUrl || "",
    };
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
    age: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    activityLevel: v.optional(v.string()),
    avatar: v.optional(v.string()),
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
        age: rest.age,
        weight: rest.weight,
        height: rest.height,
        activityLevel: rest.activityLevel,
        avatar: rest.avatar,
      });
    }

    // Also update users table avatar if provided and not empty to keep them in sync
    if (rest.avatar) {
      await ctx.db.patch(userId, { avatarUrl: rest.avatar });
    }
  },
});

/** Get credits for user (returns defaults if no row yet). */
export const getCredits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const today = todayKey();

    if (!row) {
      return {
        credits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      };
    }

    const subCredits = row.credits ?? ((row.mealCredits ?? 0) + (row.aiCredits ?? 0));
    const packCredits = row.purchasedCredits ?? 0;
    const total = subCredits + packCredits;

    if (row.lastFreeDate !== today) {
      return { ...row, credits: total, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    return { ...row, credits: total };
  },
});

export const consumeMealCredit = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const today = todayKey();
    let row = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!row) {
      const id = await ctx.db.insert("credits", {
        userId,
        credits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
      row = await ctx.db.get(id) as any;
    }

    if (row!.lastFreeDate !== today) {
      await ctx.db.patch(row!._id, { lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false });
      row = { ...row!, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false } as any;
    }

    if (!row!.dailyFreeMealUsed) {
      await ctx.db.patch(row!._id, { dailyFreeMealUsed: true });
      return { success: true };
    }

    // Drain subscription credits first, then purchased pack credits
    const subCredits = row!.credits ?? ((row!.mealCredits ?? 0) + (row!.aiCredits ?? 0));
    if (subCredits > 0) {
      await ctx.db.patch(row!._id, { credits: subCredits - 1, mealCredits: undefined, aiCredits: undefined });
      return { success: true };
    }
    const packCredits = row!.purchasedCredits ?? 0;
    if (packCredits > 0) {
      await ctx.db.patch(row!._id, { purchasedCredits: packCredits - 1 });
      return { success: true };
    }
    return { success: false };
  },
});

export const consumeAICredit = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const today = todayKey();
    let row = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!row) {
      const id = await ctx.db.insert("credits", {
        userId,
        credits: 0,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
      row = await ctx.db.get(id) as any;
    }

    if (row!.lastFreeDate !== today) {
      await ctx.db.patch(row!._id, { lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false });
      row = { ...row!, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false } as any;
    }

    if (!row!.dailyFreeAIUsed) {
      await ctx.db.patch(row!._id, { dailyFreeAIUsed: true });
      return { success: true };
    }

    // Drain subscription credits first, then purchased pack credits
    const subCredits = row!.credits ?? ((row!.mealCredits ?? 0) + (row!.aiCredits ?? 0));
    if (subCredits > 0) {
      await ctx.db.patch(row!._id, { credits: subCredits - 1, mealCredits: undefined, aiCredits: undefined });
      return { success: true };
    }
    const packCredits = row!.purchasedCredits ?? 0;
    if (packCredits > 0) {
      await ctx.db.patch(row!._id, { purchasedCredits: packCredits - 1 });
      return { success: true };
    }
    return { success: false };
  },
});

export const addCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.optional(v.number()),
    mealCredits: v.optional(v.number()),
    aiCredits: v.optional(v.number()),
  },
  handler: async (ctx, { userId, amount, mealCredits, aiCredits }) => {
    const today = todayKey();
    let row = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const addAmount = (amount ?? 0) + (mealCredits ?? 0) + (aiCredits ?? 0);

    if (!row) {
      await ctx.db.insert("credits", {
        userId,
        credits: 0,
        purchasedCredits: addAmount,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    } else {
      await ctx.db.patch(row._id, {
        purchasedCredits: (row.purchasedCredits ?? 0) + addAmount,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    }
  },
});

const VALID_COUPONS: Record<string, number> = {
  NOURISH10: 10,
  NOURISH15: 15,
  NOURISH20: 20,
  NOURISH25: 25,
  NOURISH100: 100,
  NOURISH200: 200,
  NOURISH300: 300,
};

function getValidCoupons(): Record<string, number> {
  return VALID_COUPONS;
}

export const redeemCoupon = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, { userId, code }) => {
    const uppercaseCode = code.trim().toUpperCase();

    // Validate coupon code
    const coupons = getValidCoupons();
    const reward = coupons[uppercaseCode];
    if (!reward) {
      throw new ConvexError("Invalid coupon code.");
    }

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("User not found. Please sign in again.");
    }

    // Get or create credits row
    const today = todayKey();
    const row = await ctx.db
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!row) {
      await ctx.db.insert("credits", {
        userId,
        credits: 0,
        purchasedCredits: reward,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
        usedCoupons: [uppercaseCode],
      });
      return { success: true, reward };
    }

    // Enforce one-coupon rule (except for allowed users)
    const usedCoupons = row.usedCoupons ?? [];
    const isAllowedUser = user.email === "elitesquadp@protonmail.com";
    if (usedCoupons.length > 0 && !isAllowedUser) {
      throw new ConvexError("You have already redeemed a coupon code. Only one coupon is allowed per account.");
    }

    await ctx.db.patch(row._id, {
      purchasedCredits: (row.purchasedCredits ?? 0) + reward,
      usedCoupons: [...usedCoupons, uppercaseCode],
    });

    return { success: true, reward };
  },
});
