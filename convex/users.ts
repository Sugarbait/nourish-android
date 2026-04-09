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

    const mappedCredits = row.credits ?? ((row.mealCredits ?? 0) + (row.aiCredits ?? 0));

    if (row.lastFreeDate !== today) {
      return { ...row, credits: mappedCredits, lastFreeDate: today, dailyFreeMealUsed: false, dailyFreeAIUsed: false };
    }

    return { ...row, credits: mappedCredits };
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

    let mappedCredits = row!.credits ?? ((row!.mealCredits ?? 0) + (row!.aiCredits ?? 0));
    if (mappedCredits > 0) {
      await ctx.db.patch(row!._id, { credits: mappedCredits - 1, mealCredits: undefined, aiCredits: undefined });
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

    let mappedCredits = row!.credits ?? ((row!.mealCredits ?? 0) + (row!.aiCredits ?? 0));
    if (mappedCredits > 0) {
      await ctx.db.patch(row!._id, { credits: mappedCredits - 1, mealCredits: undefined, aiCredits: undefined });
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
        credits: addAmount,
        lastFreeDate: today,
        dailyFreeMealUsed: false,
        dailyFreeAIUsed: false,
      });
    } else {
      let mappedCredits = row.credits ?? ((row.mealCredits ?? 0) + (row.aiCredits ?? 0));
      await ctx.db.patch(row._id, {
        credits: mappedCredits + addAmount,
        mealCredits: undefined,
        aiCredits: undefined,
      });
    }
  },
});

const VALID_COUPONS: Record<string, number> = {
  "NOURISH100": 100,
  "NOURISH200": 200,
  "NOURISH300": 300,
};

export const redeemCoupon = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, { userId, code }) => {
    try {
      const uppercaseCode = code.trim().toUpperCase();
      const reward = VALID_COUPONS[uppercaseCode];
      
      if (!reward) {
        throw new ConvexError("Invalid coupon code.");
      }

      // Check if user exists
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new ConvexError("User not found. Please sign in again.");
      }

      const today = todayKey();
      let row = await ctx.db
        .query("credits")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      if (!row) {
        await ctx.db.insert("credits", {
          userId,
          credits: reward,
          lastFreeDate: today,
          dailyFreeMealUsed: false,
          dailyFreeAIUsed: false,
          usedCoupons: [uppercaseCode],
        });
        return { success: true, reward };
      }

      const usedCoupons = row.usedCoupons ?? [];
      if (usedCoupons.includes(uppercaseCode)) {
        throw new ConvexError("You have already used this coupon code.");
      }

      let mappedCredits = row.credits ?? ((row.mealCredits ?? 0) + (row.aiCredits ?? 0));
      await ctx.db.patch(row._id, {
        credits: mappedCredits + reward,
        mealCredits: undefined,
        aiCredits: undefined,
        usedCoupons: [...usedCoupons, uppercaseCode],
      });

      return { success: true, reward };
    } catch (err: any) {
      if (err instanceof ConvexError) throw err;
      console.error("Redeem Coupon Error:", err);
      throw new ConvexError(`Server error: ${err.message || "Unknown error"}`);
    }
  },
});
