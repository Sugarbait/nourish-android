import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getWaterForDate = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    const log = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .first();

    return log?.glasses ?? 0;
  },
});

export const setWaterGlasses = mutation({
  args: { userId: v.id("users"), date: v.string(), glasses: v.number() },
  handler: async (ctx, { userId, date, glasses }) => {
    const existing = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { glasses });
    } else {
      await ctx.db.insert("waterLogs", {
        userId,
        date,
        glasses,
      });
    }
  },
});
