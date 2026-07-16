"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { randomBytes } from "crypto";
import { verify } from "otplib";
import { sha256Hex } from "./util/sha256";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type LoginResult =
  | { success: true; sessionToken: string; email: string }
  | { success: false; totpRequired: true }
  | {
      success: false;
      error: string;
      locked?: boolean;
      unlockAt?: number;
      msRemaining?: number;
      attemptsRemaining?: number;
    };

/**
 * Single-round-trip admin login: rate limit → password → TOTP (when enabled)
 * → mint a server-side session token. Admin functions accept ONLY this token;
 * passing the password check alone grants nothing, and the TOTP check cannot
 * be reached (or brute-forced) without the correct password in the same call.
 *
 * Credentials come exclusively from Convex environment variables
 * (ADMIN_EMAIL_1 / ADMIN_PASSWORD_1) — never from source code.
 */
export const adminLogin = action({
  args: {
    email: v.string(),
    password: v.string(),
    totpCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LoginResult> => {
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

    const recordFailure = async (): Promise<LoginResult> => {
      await ctx.runMutation(internal.adminAuth._recordFailure, { email: args.email, at: now });
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
      return { success: false, attemptsRemaining: remaining, error: "Invalid credentials" };
    };

    const admins = [
      { email: process.env.ADMIN_EMAIL_1, password: process.env.ADMIN_PASSWORD_1 },
      { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2 },
    ].filter(
      (a): a is { email: string; password: string } =>
        typeof a.email === "string" && a.email.length > 0 &&
        typeof a.password === "string" && a.password.length > 0,
    );
    if (admins.length === 0) {
      return { success: false, error: "Admin login is not configured on the server." };
    }

    const inputEmail = args.email.trim().toLowerCase();
    const match = admins.find(
      (a) => a.email.toLowerCase() === inputEmail && a.password === args.password,
    );
    if (!match) return recordFailure();

    // Second factor, when the admin has TOTP enabled.
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail: match.email });
    if (config && config.enabled && config.verified) {
      if (!args.totpCode) {
        // Not a failed attempt — the UI now shows the code prompt.
        return { success: false, totpRequired: true };
      }
      const result = await verify({ token: args.totpCode.trim(), secret: config.secret });
      if (!result || !result.valid) return recordFailure();
    }

    await ctx.runMutation(internal.adminAuth._clearFailures, { email: args.email });

    const sessionToken = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.adminSession._storeSession, {
      tokenHash: sha256Hex(sessionToken),
      email: match.email,
    });
    return { success: true, sessionToken, email: match.email };
  },
});
