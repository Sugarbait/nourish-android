"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const verifyAdmin = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.runQuery(internal.adminAuth._getRecentFailures, {
      email: args.email,
      since: Date.now() - WINDOW_MS,
    });
    if (attempts >= MAX_ATTEMPTS) {
      return {
        success: false,
        locked: true,
        error: "Too many failed attempts. Please wait 15 minutes and try again.",
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
        at: Date.now(),
      });
      return { success: false, error: "Invalid credentials" };
    }

    await ctx.runMutation(internal.adminAuth._clearFailures, { email: args.email });
    return { success: true, email: match.email };
  },
});
