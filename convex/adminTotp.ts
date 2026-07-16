"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Nourish Admin";

/**
 * TOTP management. Every action here requires a live admin session token and
 * derives the admin email from the session — the caller cannot manage TOTP
 * for an arbitrary email. Login-time TOTP *verification* lives inside
 * admin.adminLogin so codes can never be brute-forced without the password.
 */

async function requireSessionEmail(ctx: any, sessionToken: string): Promise<string> {
  const email: string | null = await ctx.runQuery(internal.adminSession._verifySession, {
    sessionToken,
  });
  if (!email) throw new ConvexError("ADMIN_SESSION_INVALID");
  return email;
}

export const generateSetupData = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> => {
    const adminEmail = await requireSessionEmail(ctx, sessionToken);
    const secret = generateSecret({ length: 20 });
    const otpauthUrl = generateURI({ issuer: ISSUER, label: adminEmail, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 2 });
    await ctx.runMutation(internal.adminTotpDb._createConfig, { adminEmail, secret });
    return { secret, otpauthUrl, qrDataUrl };
  },
});

export const verifyAndEnable = action({
  args: { sessionToken: v.string(), code: v.string() },
  handler: async (ctx, { sessionToken, code }): Promise<{ success: boolean; error?: string }> => {
    const adminEmail = await requireSessionEmail(ctx, sessionToken);
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail });
    if (!config) return { success: false, error: "No pending TOTP setup found. Please regenerate." };
    const result = await verify({ token: code.trim(), secret: config.secret });
    if (!result || !result.valid) return { success: false, error: "Invalid code. Please try again." };
    await ctx.runMutation(internal.adminTotpDb._enableConfig, { adminEmail, secret: config.secret });
    return { success: true };
  },
});

export const disable = action({
  args: { sessionToken: v.string(), code: v.string() },
  handler: async (ctx, { sessionToken, code }): Promise<{ success: boolean; error?: string }> => {
    const adminEmail = await requireSessionEmail(ctx, sessionToken);
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail });
    if (!config || !config.enabled) return { success: false, error: "TOTP is not currently enabled." };
    const result = await verify({ token: code.trim(), secret: config.secret });
    if (!result || !result.valid) return { success: false, error: "Invalid code. Please try again." };
    await ctx.runMutation(internal.adminTotpDb._disableConfig, { adminEmail });
    return { success: true };
  },
});
