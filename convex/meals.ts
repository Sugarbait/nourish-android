import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

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
    imageStorageId: v.optional(v.id("_storage")),
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
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .collect();
    return await Promise.all(
      meals.map(async (meal) => ({
        ...meal,
        imageUrl: meal.imageStorageId
          ? await ctx.storage.getUrl(meal.imageStorageId)
          : null,
      }))
    );
  },
});

export const attachMealImage = mutation({
  args: {
    userId: v.id("users"),
    localId: v.string(),
    imageStorageId: v.id("_storage"),
  },
  handler: async (ctx, { userId, localId, imageStorageId }) => {
    const meal = await ctx.db
      .query("meals")
      .withIndex("by_userId_localId", (q) =>
        q.eq("userId", userId).eq("localId", localId)
      )
      .first();
    if (!meal || meal.userId !== userId) return;
    await ctx.db.patch(meal._id, { imageStorageId });
  },
});

export const getMealsForDateRange = query({
  args: { userId: v.id("users"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { userId, startDate, endDate }) => {
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate)
      )
      .collect();
    return await Promise.all(
      meals.map(async (meal) => ({
        ...meal,
        imageUrl: meal.imageStorageId
          ? await ctx.storage.getUrl(meal.imageStorageId)
          : null,
      }))
    );
  },
});

export const getMealsForPastYear = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const startDateStr = oneYearAgo.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    return await ctx.db
      .query("meals")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).gte("date", startDateStr).lte("date", endDateStr)
      )
      .collect();
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
    const match = await ctx.db
      .query("meals")
      .withIndex("by_userId_localId", (q) =>
        q.eq("userId", userId).eq("localId", localId)
      )
      .first();
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
    const meal = await ctx.db
      .query("meals")
      .withIndex("by_userId_localId", (q) =>
        q.eq("userId", userId).eq("localId", localId)
      )
      .first();
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

/** Update healthScore + healthAnalysis after the user edits a meal's items. */
export const updateMealHealthAnalysis = mutation({
  args: {
    userId: v.id("users"),
    localId: v.string(),
    healthScore: v.number(),
    healthAnalysis: v.string(),
  },
  handler: async (ctx, { userId, localId, healthScore, healthAnalysis }) => {
    const meal = await ctx.db
      .query("meals")
      .withIndex("by_userId_localId", (q) => q.eq("userId", userId).eq("localId", localId))
      .first();
    if (!meal) return; // not yet synced
    await ctx.db.patch(meal._id, { healthScore, healthAnalysis });
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
    const meal = await ctx.db
      .query("meals")
      .withIndex("by_userId_localId", (q) =>
        q.eq("userId", userId).eq("localId", localId)
      )
      .first();
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
        v.literal("breakfast"), v.literal("Breakfast"),
        v.literal("lunch"), v.literal("Lunch"),
        v.literal("dinner"), v.literal("Dinner"),
        v.literal("snack"), v.literal("Snacks"), v.literal("Snack")
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
    try {
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
          const normalizedType = (rawType === 'snacks' ? 'snack' : rawType) as "breakfast" | "lunch" | "dinner" | "snack";

          await ctx.db.insert("meals", {
            userId,
            date: meal.date,
            mealType: normalizedType,
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            items: meal.items,
            localId: meal.localId,
            healthScore: meal.healthScore,
            healthAnalysis: meal.healthAnalysis,
            createdAt: Date.now(),
          });
          addedCount++;
        }
      }
      return { addedCount };
    } catch (error: any) {
      console.error("syncBatchMeals error:", error);
      throw new ConvexError(`Failed to sync meals: ${error.toString()}`);
    }
  },
});

/** Get all unique dates where the user has logged meals */
export const getTrackedDates = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    try {
      const meals = await ctx.db
        .query("meals")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      
      const dates = new Set(meals.map(m => m.date));
      return Array.from(dates).sort();
    } catch (error: any) {
      throw new ConvexError(`Failed to get tracked dates: ${error.message}`);
    }
  },
});

/** Admin: total meals logged per user, returned as { userId, count } rows. */
export const adminListMealCounts = query({
  args: {},
  handler: async (ctx) => {
    const meals = await ctx.db.query("meals").collect();
    const counts = new Map<string, number>();
    for (const m of meals) {
      const key = m.userId as unknown as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([userId, count]) => ({ userId, count }));
  },
});
