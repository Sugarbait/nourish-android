// V8 runtime — database access only
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { verifySessionEmail } from "./adminSession";

export const _getConfig = internalQuery({
  args: { adminEmail: v.string() },
  handler: async (ctx, { adminEmail }) => {
    const configs = await ctx.db
      .query("adminTotpConfig")
      .withIndex("by_email", (q) => q.eq("adminEmail", adminEmail))
      .collect();
    return configs[0] ?? null;
  },
});

export const _createConfig = internalMutation({
  args: { adminEmail: v.string(), secret: v.string() },
  handler: async (ctx, { adminEmail, secret }) => {
    const existing = await ctx.db
      .query("adminTotpConfig")
      .withIndex("by_email", (q) => q.eq("adminEmail", adminEmail))
      .collect();
    for (const c of existing) {
      if (!c.verified) await ctx.db.delete(c._id);
    }
    await ctx.db.insert("adminTotpConfig", {
      adminEmail,
      secret,
      enabled: false,
      verified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const _enableConfig = internalMutation({
  args: { adminEmail: v.string(), secret: v.string() },
  handler: async (ctx, { adminEmail, secret }) => {
    const configs = await ctx.db
      .query("adminTotpConfig")
      .withIndex("by_email", (q) => q.eq("adminEmail", adminEmail))
      .collect();
    for (const c of configs) {
      if (c.secret !== secret) await ctx.db.delete(c._id);
    }
    const config = configs.find((c) => c.secret === secret);
    if (!config) throw new Error("TOTP config not found");
    await ctx.db.patch(config._id, { enabled: true, verified: true, updatedAt: Date.now() });
  },
});

export const _disableConfig = internalMutation({
  args: { adminEmail: v.string() },
  handler: async (ctx, { adminEmail }) => {
    const configs = await ctx.db
      .query("adminTotpConfig")
      .withIndex("by_email", (q) => q.eq("adminEmail", adminEmail))
      .collect();
    for (const c of configs) await ctx.db.delete(c._id);
  },
});

export const getStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const adminEmail = await verifySessionEmail(ctx, sessionToken);
    if (!adminEmail) return null;
    const configs = await ctx.db
      .query("adminTotpConfig")
      .withIndex("by_email", (q) => q.eq("adminEmail", adminEmail))
      .collect();
    const active = configs.find((c) => c.enabled && c.verified);
    return { enabled: !!active };
  },
});
