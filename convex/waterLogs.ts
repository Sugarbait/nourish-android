import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const getWaterForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return 0;

    const log = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .first();

    return log?.glasses ?? 0;
  },
});

export const setWaterGlasses = mutation({
  args: { date: v.string(), glasses: v.number() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { glasses: args.glasses });
    } else {
      await ctx.db.insert("waterLogs", {
        userId,
        date: args.date,
        glasses: args.glasses,
      });
    }
  },
});
