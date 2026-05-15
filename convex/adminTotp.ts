"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Nourish Admin";

export const generateSetupData = action({
  args: { adminEmail: v.string() },
  handler: async (ctx, { adminEmail }): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> => {
    const secret = generateSecret({ length: 20 });
    const otpauthUrl = generateURI({ issuer: ISSUER, label: adminEmail, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 2 });
    await ctx.runMutation(internal.adminTotpDb._createConfig, { adminEmail, secret });
    return { secret, otpauthUrl, qrDataUrl };
  },
});

export const verifyAndEnable = action({
  args: { adminEmail: v.string(), code: v.string() },
  handler: async (ctx, { adminEmail, code }): Promise<{ success: boolean; error?: string }> => {
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail });
    if (!config) return { success: false, error: "No pending TOTP setup found. Please regenerate." };
    const result = await verify({ token: code.trim(), secret: config.secret });
    if (!result || !result.valid) return { success: false, error: "Invalid code. Please try again." };
    await ctx.runMutation(internal.adminTotpDb._enableConfig, { adminEmail, secret: config.secret });
    return { success: true };
  },
});

export const verifyCode = action({
  args: { adminEmail: v.string(), code: v.string() },
  handler: async (ctx, { adminEmail, code }): Promise<{ valid: boolean }> => {
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail });
    if (!config || !config.enabled || !config.verified) return { valid: true };
    const result = await verify({ token: code.trim(), secret: config.secret });
    return { valid: !!(result && result.valid) };
  },
});

export const disable = action({
  args: { adminEmail: v.string(), code: v.string() },
  handler: async (ctx, { adminEmail, code }): Promise<{ success: boolean; error?: string }> => {
    const config = await ctx.runQuery(internal.adminTotpDb._getConfig, { adminEmail });
    if (!config || !config.enabled) return { success: false, error: "TOTP is not currently enabled." };
    const result = await verify({ token: code.trim(), secret: config.secret });
    if (!result || !result.valid) return { success: false, error: "Invalid code. Please try again." };
    await ctx.runMutation(internal.adminTotpDb._disableConfig, { adminEmail });
    return { success: true };
  },
});
