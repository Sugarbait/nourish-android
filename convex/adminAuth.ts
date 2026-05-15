// V8 runtime — rate limiting helpers for admin login
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const _getRecentFailures = internalQuery({
  args: { email: v.string(), since: v.number() },
  handler: async (ctx, { email, since }) => {
    const rows = await ctx.db
      .query("adminLoginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    return rows.filter((r) => r.at >= since).length;
  },
});

export const _recordFailure = internalMutation({
  args: { email: v.string(), at: v.number() },
  handler: async (ctx, { email, at }) => {
    await ctx.db.insert("adminLoginAttempts", { email, at });
  },
});

export const _clearFailures = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const rows = await ctx.db
      .query("adminLoginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
