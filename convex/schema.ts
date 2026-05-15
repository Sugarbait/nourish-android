import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    authProvider: v.optional(v.string()), // 'google' | 'microsoft'
    oauthProviderId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    resetCode: v.optional(v.string()),
    resetCodeExpiry: v.optional(v.number()),
    emailVerified: v.optional(v.boolean()),
    verificationToken: v.optional(v.string()),
    verificationTokenExpiry: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    banned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    // Legacy fields from @convex-dev/auth — kept for backward compatibility with existing data
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_oauth", ["authProvider", "oauthProviderId"]),

  // Extended user profile
  profiles: defineTable({
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.string(),
    // Demographics & Physical
    age: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    activityLevel: v.optional(v.string()),
    avatar: v.optional(v.string()),
    // Goals
    calorieGoal: v.number(),
    proteinGoal: v.number(),
    carbsGoal: v.number(),
    fatGoal: v.number(),
    waterGoal: v.number(),
    // Diet preferences
    dietaryRestrictions: v.optional(v.string()),
    // Notification preferences
    notificationPreferences: v.optional(v.object({
      mealReminders: v.boolean(),
      goalNudges: v.boolean(),
      creditResetAlert: v.boolean(),
      coachInsights: v.boolean(),
    })),
  }).index("by_userId", ["userId"]),

  // Meal logs
  meals: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    mealType: v.union(
      v.literal("breakfast"), v.literal("Breakfast"),
      v.literal("lunch"), v.literal("Lunch"),
      v.literal("dinner"), v.literal("Dinner"),
      v.literal("snack"), v.literal("Snack"), v.literal("Snacks")
    ),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    healthScore: v.optional(v.number()),
    healthAnalysis: v.optional(v.string()),
    localId: v.optional(v.string()),
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
    .index("by_userId", ["userId"])
    .index("by_userId_localId", ["userId", "localId"]),

  // Credits tracking (replaces localStorage)
  credits: defineTable({
    userId: v.id("users"),
    credits: v.number(),               // subscription credits — reset to 300 on renewal
    purchasedCredits: v.optional(v.number()), // pack/coupon credits — never expire
    mealCredits: v.optional(v.number()), // deprecated
    aiCredits: v.optional(v.number()),   // deprecated
    lastFreeDate: v.string(),
    dailyFreeMealUsed: v.boolean(),
    dailyFreeAIUsed: v.boolean(),
    usedCoupons: v.optional(v.array(v.string())),
  }).index("by_userId", ["userId"]),

  // Subscriptions
  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("monthly"), v.literal("yearly"), v.null()),
    active: v.boolean(),
    expiresAt: v.optional(v.number()), // Unix timestamp ms
    lastCreditRefresh: v.optional(v.number()), // ms — when subscription credits were last refreshed (used by yearly cron)
  })
    .index("by_userId", ["userId"])
    .index("by_active_plan", ["active", "plan"]),

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

  // Contact form submissions
  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    app: v.string(),
    createdAt: v.number(),
  }),

  // Saved recipes
  savedRecipes: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    source: v.union(v.literal("generated"), v.literal("shared")),
    savedAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  // Saved AI coach conversations
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Recipe shares (for public sharing)
  recipeShares: defineTable({
    userId: v.id("users"),
    shareId: v.string(),
    name: v.string(),
    description: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_shareId", ["shareId"]),

  // Admin: rate-limit login attempts
  adminLoginAttempts: defineTable({
    email: v.string(),
    at: v.number(),
  }).index("by_email", ["email"]),

  // Admin: TOTP 2FA config per admin email
  adminTotpConfig: defineTable({
    adminEmail: v.string(),
    secret: v.string(),
    enabled: v.boolean(),
    verified: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["adminEmail"]),
});
