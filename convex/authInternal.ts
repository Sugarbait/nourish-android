import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const getUserByOAuth = internalQuery({
  args: { authProvider: v.string(), oauthProviderId: v.string() },
  handler: async (ctx, { authProvider, oauthProviderId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_oauth", (q) =>
        q.eq("authProvider", authProvider).eq("oauthProviderId", oauthProviderId)
      )
      .first();
  },
});

export const createUser = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    authProvider: v.optional(v.string()),
    oauthProviderId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    verificationToken: v.optional(v.string()),
    verificationTokenExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateUserVerification = internalMutation({
  args: {
    userId: v.id("users"),
    emailVerified: v.optional(v.boolean()),
    verificationToken: v.optional(v.string()),
    verificationTokenExpiry: v.optional(v.number()),
  },
  handler: async (ctx, { userId, emailVerified, verificationToken, verificationTokenExpiry }) => {
    const patch: any = {};
    if (emailVerified !== undefined) patch.emailVerified = emailVerified;
    if (verificationToken !== undefined) patch.verificationToken = verificationToken;
    if (verificationTokenExpiry !== undefined) patch.verificationTokenExpiry = verificationTokenExpiry;
    await ctx.db.patch(userId, patch);
  },
});

export const updateOAuthUser = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, avatarUrl }) => {
    const patch: any = {};
    if (name !== undefined) patch.name = name;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
    await ctx.db.patch(userId, patch);
  },
});

export const updateUserResetCode = internalMutation({
  args: {
    userId: v.id("users"),
    resetCode: v.string(),
    resetCodeExpiry: v.number(),
  },
  handler: async (ctx, { userId, resetCode, resetCodeExpiry }) => {
    await ctx.db.patch(userId, { resetCode, resetCodeExpiry });
  },
});

export const updateUserPassword = internalMutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, passwordHash }) => {
    // Patch password first — do NOT mix undefined values in the same patch object,
    // as Convex's V8 runtime can silently drop the entire write when undefined is present.
    await ctx.db.patch(userId, { passwordHash });
    // Clear the one-time reset fields separately.
    await ctx.db.patch(userId, { resetCode: undefined, resetCodeExpiry: undefined });
  },
});
