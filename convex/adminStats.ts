import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifySessionEmail } from "./adminSession";

export const getAppStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (!(await verifySessionEmail(ctx, sessionToken))) return null;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const since7 = now - 7 * day;
    const since30 = now - 30 * day;

    const users = await ctx.db.query("users").collect();
    const meals = await ctx.db.query("meals").collect();
    const water = await ctx.db.query("waterLogs").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const credits = await ctx.db.query("credits").collect();
    const aiMessages = await ctx.db.query("aiMessages").collect();

    const totalUsers = users.length;
    const verifiedUsers = users.filter(u => u.emailVerified).length;
    const bannedUsers = users.filter(u => u.banned).length;
    const newUsers7d = users.filter(u => u._creationTime >= since7).length;
    const newUsers30d = users.filter(u => u._creationTime >= since30).length;

    const totalMeals = meals.length;
    const meals7d = meals.filter(m => m.createdAt >= since7).length;
    const meals30d = meals.filter(m => m.createdAt >= since30).length;
    const activeUsers7d = new Set(meals.filter(m => m.createdAt >= since7).map(m => m.userId)).size;
    const activeUsers30d = new Set(meals.filter(m => m.createdAt >= since30).map(m => m.userId)).size;

    const totalCaloriesLogged = meals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalWaterGlasses = water.reduce((s, w) => s + (w.glasses || 0), 0);

    const activeSubs = subs.filter(s => s.active);
    const monthlySubs = activeSubs.filter(s => s.plan === "monthly").length;
    const yearlySubs = activeSubs.filter(s => s.plan === "yearly").length;

    const totalCredits = credits.reduce((s, c) => s + (c.credits || 0) + (c.purchasedCredits || 0), 0);
    const totalAiMessages = aiMessages.length;

    const mealTypeCounts: Record<string, number> = {};
    meals.forEach(m => {
      const t = m.mealType.toLowerCase();
      mealTypeCounts[t] = (mealTypeCounts[t] || 0) + 1;
    });

    const userMealCounts: Record<string, number> = {};
    meals.forEach(m => {
      userMealCounts[m.userId] = (userMealCounts[m.userId] || 0) + 1;
    });
    const userById = new Map(users.map(u => [u._id, u]));
    const topUsers = Object.entries(userMealCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([uid, count]) => ({
        email: userById.get(uid as any)?.email || 'unknown',
        mealCount: count,
      }));

    const signupsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now - i * day);
      const key = d.toISOString().slice(0, 10);
      signupsByDay[key] = 0;
    }
    users.forEach(u => {
      const key = new Date(u._creationTime).toISOString().slice(0, 10);
      if (key in signupsByDay) signupsByDay[key]++;
    });
    const signupTrend = Object.entries(signupsByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      totalUsers, verifiedUsers, bannedUsers, newUsers7d, newUsers30d,
      totalMeals, meals7d, meals30d, activeUsers7d, activeUsers30d,
      totalCaloriesLogged, totalWaterGlasses,
      activeSubs: activeSubs.length, monthlySubs, yearlySubs,
      totalCredits, totalAiMessages,
      mealTypeCounts, topUsers, signupTrend,
    };
  },
});
