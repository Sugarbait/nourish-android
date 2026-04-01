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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      ...args,
      createdAt: Date.now(),
    });
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
    await ctx.db.patch(userId, { passwordHash, resetCode: undefined, resetCodeExpiry: undefined });
  },
});
