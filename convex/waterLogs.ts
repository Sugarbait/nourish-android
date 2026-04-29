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

/** Batch sync water logs from local storage to Convex */
export const syncBatchWater = mutation({
  args: {
    userId: v.id("users"),
    logs: v.array(v.object({
      date: v.string(),
      glasses: v.number(),
    })),
  },
  handler: async (ctx, { userId, logs }) => {
    let syncedCount = 0;
    for (const log of logs) {
      const existing = await ctx.db
        .query("waterLogs")
        .withIndex("by_userId_date", (q) =>
          q.eq("userId", userId).eq("date", log.date)
        )
        .first();

      if (existing) {
        // Only update if the local count is higher (assume latest guest data is more accurate than empty profile)
        if (log.glasses > existing.glasses) {
          await ctx.db.patch(existing._id, { glasses: log.glasses });
          syncedCount++;
        }
      } else if (log.glasses > 0) {
        await ctx.db.insert("waterLogs", {
          userId,
          date: log.date,
          glasses: log.glasses,
        });
        syncedCount++;
      }
    }
    return { syncedCount };
  },
});
