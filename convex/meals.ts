import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

const mealItemSchema = v.object({
  name: v.string(),
  calories: v.number(),
  protein: v.number(),
  carbs: v.number(),
  fat: v.number(),
  confidence: v.optional(v.number()),
});

export const logMeal = mutation({
  args: {
    date: v.string(),
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    ),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    healthScore: v.optional(v.number()),
    items: v.array(mealItemSchema),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("meals", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getMealsForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("meals")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .collect();
  },
});

export const getMealsForDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const all = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return all.filter(
      (m) => m.date >= args.startDate && m.date <= args.endDate
    );
  },
});

export const deleteMeal = mutation({
  args: { mealId: v.id("meals") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const meal = await ctx.db.get(args.mealId);
    if (!meal || meal.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.mealId);
  },
});
