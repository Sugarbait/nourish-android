"use node";

import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import bcrypt from "bcryptjs";

/**
 * Public action that deletes a user account and ALL associated data.
 *
 * Password verification:
 *  - Password-based users must provide their password (verified via bcrypt).
 *  - OAuth users (Google / Microsoft) have no password — the UI already
 *    requires typing "DELETE" as confirmation, and the request is scoped
 *    to their own userId taken from authenticated local storage.
 */
export const deleteUserAccount = action({
  args: {
    userId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { userId, password }): Promise<{ success: true }> => {
    if (!userId) throw new ConvexError("User ID is required");

    const user = await ctx.runQuery(internal.accountDeletionInternal.getUserForDeletion, {
      userId: userId as Id<"users">,
    });
    if (!user) throw new ConvexError("User not found");

    if (user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new ConvexError("Invalid password");
    }
    // OAuth user: no password to check; UI confirmation ("DELETE") is sufficient.

    await ctx.runMutation(internal.accountDeletionInternal.deleteAllUserData, {
      userId: userId as Id<"users">,
    });
    return { success: true };
  },
});
