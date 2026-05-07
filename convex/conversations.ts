import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveConversation = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, { userId, title, messages }) => {
    // Keep only last 5 conversations — delete oldest if over limit
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const sorted = existing.sort((a, b) => b.createdAt - a.createdAt);
    if (sorted.length >= 5) {
      for (const old of sorted.slice(4)) {
        await ctx.db.delete(old._id);
      }
    }

    await ctx.db.insert("conversations", {
      userId,
      title,
      messages,
      createdAt: Date.now(),
    });
  },
});

export const getRecentConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return convos.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  },
});
