"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const verifyEmailToken = action({
  args: {
    token: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { token, email }): Promise<{ success: boolean; userId: string; name: string | null; avatarUrl: string | null }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: normalizedEmail });
    if (!user) throw new Error("Invalid verification link.");

    if (!user.verificationToken || user.verificationToken !== token) {
      throw new Error("Invalid or expired verification link.");
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < Date.now()) {
      throw new Error("This verification link has expired. Please sign up again or contact support.");
    }

    await ctx.runMutation(internal.authInternal.updateUserVerification, {
      userId: user._id,
      emailVerified: true,
      verificationToken: undefined,
      verificationTokenExpiry: undefined,
    });

    ctx.runAction(internal.emails.sendWelcomeEmail, {
      email: user.email,
      name: user.name ?? user.email,
    }).catch(() => {});

    return {
      success: true,
      userId: user._id as unknown as string,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  },
});
