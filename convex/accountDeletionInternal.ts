import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Public — does this user have a password? Tells the delete-account modal
 * whether to show the password field (password users) or skip it (OAuth users).
 */
export const requiresPasswordForDeletion = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<{ requiresPassword: boolean; exists: boolean }> => {
    if (!userId) return { requiresPassword: true, exists: false };
    const user = await ctx.db.get(userId as Id<"users">);
    if (!user) return { requiresPassword: true, exists: false };
    return { requiresPassword: !!user.passwordHash, exists: true };
  },
});

/** Internal — fetch user (returns passwordHash + authProvider for the deletion action). */
export const getUserForDeletion = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      passwordHash: user.passwordHash,
      authProvider: user.authProvider,
    };
  },
});

/** Internal — wipe every row this user owns, then delete the user. */
export const deleteAllUserData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const deleteByIndex = async (
      table: "meals" | "conversations" | "aiMessages" | "savedRecipes" | "profiles" | "credits" | "subscriptions" | "recipeShares",
      index: "by_userId",
    ) => {
      const rows = await ctx.db
        .query(table)
        .withIndex(index, (q) => q.eq("userId", userId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    };

    await deleteByIndex("meals", "by_userId");
    await deleteByIndex("conversations", "by_userId");
    await deleteByIndex("aiMessages", "by_userId");
    await deleteByIndex("savedRecipes", "by_userId");
    await deleteByIndex("profiles", "by_userId");
    await deleteByIndex("credits", "by_userId");
    await deleteByIndex("subscriptions", "by_userId");
    await deleteByIndex("recipeShares", "by_userId");

    // waterLogs uses a composite (userId + date) index.
    const waterLogs = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .collect();
    for (const w of waterLogs) await ctx.db.delete(w._id);

    await ctx.db.delete(userId);
    console.log("[accountDeletion] User account deleted:", userId);
  },
});
