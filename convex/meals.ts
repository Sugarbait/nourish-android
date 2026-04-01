import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    userId: v.id("users"),
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
    const { userId, ...rest } = args;
    return await ctx.db.insert("meals", {
      userId,
      ...rest,
      createdAt: Date.now(),
    });
  },
});

export const getMealsForDate = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    return await ctx.db
      .query("meals")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .collect();
  },
});

export const getMealsForDateRange = query({
  args: { userId: v.id("users"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { userId, startDate, endDate }) => {
    const all = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return all.filter(
      (m) => m.date >= startDate && m.date <= endDate
    );
  },
});

export const deleteMeal = mutation({
  args: { userId: v.id("users"), mealId: v.id("meals") },
  handler: async (ctx, { userId, mealId }) => {
    const meal = await ctx.db.get(mealId);
    if (!meal || meal.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(mealId);
  },
});
