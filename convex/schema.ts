import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Extended user profile
  profiles: defineTable({
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.string(),
    // Goals
    calorieGoal: v.number(),
    proteinGoal: v.number(),
    carbsGoal: v.number(),
    fatGoal: v.number(),
    waterGoal: v.number(),
    // Diet preferences
    dietaryRestrictions: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // Meal logs
  meals: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
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
    items: v.array(
      v.object({
        name: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
        confidence: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId", ["userId"]),

  // Credits tracking (replaces localStorage)
  credits: defineTable({
    userId: v.id("users"),
    mealCredits: v.number(),
    aiCredits: v.number(),
    lastFreeDate: v.string(),
    dailyFreeMealUsed: v.boolean(),
    dailyFreeAIUsed: v.boolean(),
  }).index("by_userId", ["userId"]),

  // Subscriptions
  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("monthly"), v.null()),
    active: v.boolean(),
    expiresAt: v.optional(v.number()), // Unix timestamp ms
  }).index("by_userId", ["userId"]),

  // Water logs
  waterLogs: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    glasses: v.number(),
  }).index("by_userId_date", ["userId", "date"]),

  // AI coach messages (persistent history)
  aiMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
});
