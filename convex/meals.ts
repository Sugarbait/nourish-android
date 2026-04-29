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
    healthAnalysis: v.optional(v.string()),
    items: v.array(mealItemSchema),
    localId: v.optional(v.string()), // the Date.now() id from localStorage for dedup
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

/** Delete a meal by its localId (the Date.now() string from localStorage) */
export const deleteMealByLocalId = mutation({
  args: { userId: v.id("users"), localId: v.string() },
  handler: async (ctx, { userId, localId }) => {
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const match = meals.find((m) => m.localId === localId);
    if (match) await ctx.db.delete(match._id);
  },
});

/** Update a single food item within a stored meal (name + recalculated nutrition) */
export const updateMealItem = mutation({
  args: {
    userId: v.id("users"),
    localId: v.string(),
    itemIndex: v.number(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
  },
  handler: async (ctx, { userId, localId, itemIndex, name, calories, protein, carbs, fat }) => {
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const meal = meals.find((m) => m.localId === localId);
    if (!meal) return; // not yet synced — skip
    const updatedItems = meal.items.map((item, idx) =>
      idx === itemIndex ? { ...item, name, calories, protein, carbs, fat } : item
    );
    // Recalculate meal totals
    const totals = updatedItems.reduce(
      (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    await ctx.db.patch(meal._id, { items: updatedItems, ...totals });
  },
});

/** Update the meal type (Breakfast/Lunch/Dinner/Snack) for a stored meal */
export const updateMealType = mutation({
  args: {
    userId: v.id("users"),
    localId: v.string(),
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    ),
    name: v.string(),
  },
  handler: async (ctx, { userId, localId, mealType, name }) => {
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const meal = meals.find((m) => m.localId === localId);
    if (!meal) return;
    await ctx.db.patch(meal._id, { mealType, name });
  },
});

/** Batch sync meals from local storage (guest history) to Convex */
export const syncBatchMeals = mutation({
  args: {
    userId: v.id("users"),
    meals: v.array(v.object({
      date: v.string(),
      mealType: v.union(
        v.literal("breakfast"),
        v.literal("lunch"),
        v.literal("dinner"),
        v.literal("snack"),
        v.literal("Snacks") // Add uppercase Snaks just in case
      ),
      name: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      items: v.array(mealItemSchema),
      localId: v.string(),
      healthScore: v.optional(v.number()),
      healthAnalysis: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { userId, meals }) => {
    // Get existing localIds for this user to avoid duplicates
    const existingMeals = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    
    const existingLocalIds = new Set(existingMeals.map(m => m.localId).filter(Boolean));
    
    let addedCount = 0;
    for (const meal of meals) {
      if (!existingLocalIds.has(meal.localId)) {
        // Normalize mealType to lowercase and handle "Snacks" plural
        const rawType = meal.mealType.toLowerCase();
        const normalizedType = (rawType === 'snacks' ? 'snack' : rawType) as any;
        
        // Exclude original mealType from spread to ensure normalizedType is used correctly
        const { mealType: _, ...mealData } = meal;
        
        await ctx.db.insert("meals", {
          userId,
          ...mealData,
          mealType: normalizedType,
          createdAt: Date.now(),
        });
        addedCount++;
      }
    }
    return { addedCount };
  },
});

/** Get all unique dates where the user has logged meals */
export const getTrackedDates = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    
    const dates = new Set(meals.map(m => m.date));
    return Array.from(dates).sort();
  },
});
