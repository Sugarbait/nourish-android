import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getMessages = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("aiMessages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, { userId, role, content }) => {
    await ctx.db.insert("aiMessages", {
      userId,
      role,
      content,
      createdAt: Date.now(),
    });
  },
});

export const clearMessages = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
  },
});
