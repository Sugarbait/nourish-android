"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type VerifyResult =
  | { success: true; email: string }
  | { success: false; error: string; locked?: boolean; unlockAt?: number; msRemaining?: number; attemptsRemaining?: number };

export const verifyAdmin = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<VerifyResult> => {
    const now = Date.now();
    const stats = await ctx.runQuery(internal.adminAuth._getFailureStats, {
      email: args.email,
      since: now - WINDOW_MS,
    });
    if (stats.count >= MAX_ATTEMPTS) {
      const unlockAt = (stats.oldestAt ?? now) + WINDOW_MS;
      return {
        success: false,
        locked: true,
        unlockAt,
        msRemaining: Math.max(0, unlockAt - now),
        error: "Too many failed attempts. Please wait and try again.",
      };
    }

    const admins = [
      { email: process.env.ADMIN_EMAIL_1, password: process.env.ADMIN_PASSWORD_1 },
      { email: "elitesquadp@protonmail.com", password: "$Ineed1millie$_nourish" },
    ].filter(
      (a): a is { email: string; password: string } =>
        typeof a.email === "string" && a.email.length > 0 &&
        typeof a.password === "string" && a.password.length > 0
    );

    const inputEmail = args.email.trim().toLowerCase();
    const match = admins.find(
      (a) => a.email.toLowerCase() === inputEmail && a.password === args.password
    );

    if (!match) {
      await ctx.runMutation(internal.adminAuth._recordFailure, {
        email: args.email,
        at: now,
      });
      const newCount = stats.count + 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - newCount);
      if (remaining === 0) {
        const unlockAt = (stats.oldestAt ?? now) + WINDOW_MS;
        return {
          success: false,
          locked: true,
          unlockAt,
          msRemaining: Math.max(0, unlockAt - now),
          error: "Too many failed attempts. Please wait and try again.",
        };
      }
      return {
        success: false,
        attemptsRemaining: remaining,
        error: "Invalid credentials",
      };
    }

    await ctx.runMutation(internal.adminAuth._clearFailures, { email: args.email });
    return { success: true, email: match.email };
  },
});
