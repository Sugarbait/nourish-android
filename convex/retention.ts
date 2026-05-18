/**
 * Data-retention housekeeping.
 *
 * Principle: the app should only keep what's needed for the user's profile
 * and history to function. This file holds:
 *
 *   - A one-shot mutation (`clearLegacyUserFields`) that strips fields from
 *     `users` rows that are declared in the schema for backward-compatibility
 *     but never read by the app today.
 *   - Daily prune mutations wired to crons in `convex/crons.ts` that age
 *     out admin rate-limit data, old AI chat history, old support messages,
 *     and expired auth-flow tokens.
 *
 * Retention periods:
 *   - adminLoginAttempts:  7 days
 *   - aiMessages:         90 days
 *   - contactMessages:   365 days
 *   - expired resetCode / verificationToken: removed once expiry passes
 *
 * Crons are conservative (only-internal, idempotent, bounded batches). They
 * delete by primary key after querying — there are no destructive bulk ops.
 */

import { internalMutation } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;

const ADMIN_LOGIN_ATTEMPTS_TTL_MS  =   7 * DAY_MS;
const AI_MESSAGES_TTL_MS           =  90 * DAY_MS;
const CONTACT_MESSAGES_TTL_MS      = 365 * DAY_MS;

/** Cap on how many rows each prune deletes per run, so we never block a
 * cron tick on a runaway table. Crons run daily; backlog drains over time. */
const PRUNE_BATCH_LIMIT = 500;

// ---------------------------------------------------------------------------
// One-shot: clear legacy @convex-dev/auth fields from existing user rows.
// These columns are declared in the schema as optional for backward-compat,
// but no code path reads them anymore. Safe to wipe.
// ---------------------------------------------------------------------------
export const clearLegacyUserFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let touched = 0;
    for (const u of users) {
      const hasLegacy =
        u.image !== undefined ||
        u.emailVerificationTime !== undefined ||
        u.phone !== undefined ||
        u.phoneVerificationTime !== undefined ||
        u.isAnonymous !== undefined;
      if (!hasLegacy) continue;
      await ctx.db.patch(u._id, {
        image: undefined,
        emailVerificationTime: undefined,
        phone: undefined,
        phoneVerificationTime: undefined,
        isAnonymous: undefined,
      });
      touched += 1;
    }
    return { touched, scanned: users.length };
  },
});

// ---------------------------------------------------------------------------
// Daily: prune admin login attempts older than the rate-limit window.
// ---------------------------------------------------------------------------
export const pruneOldAdminLoginAttempts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ADMIN_LOGIN_ATTEMPTS_TTL_MS;
    const rows = await ctx.db.query("adminLoginAttempts").collect();
    let deleted = 0;
    for (const r of rows) {
      if (deleted >= PRUNE_BATCH_LIMIT) break;
      if (r.at < cutoff) {
        await ctx.db.delete(r._id);
        deleted += 1;
      }
    }
    return { deleted, scanned: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Daily: prune AI chat messages older than 90 days.
// The coach context already only uses the last 90 days; older messages
// have no functional purpose. Users who want to preserve a specific
// conversation can use the existing "Save conversation" feature, which
// writes to the `conversations` table (not pruned).
// ---------------------------------------------------------------------------
export const pruneOldAiMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - AI_MESSAGES_TTL_MS;
    const rows = await ctx.db.query("aiMessages").collect();
    let deleted = 0;
    for (const r of rows) {
      if (deleted >= PRUNE_BATCH_LIMIT) break;
      if (r.createdAt < cutoff) {
        await ctx.db.delete(r._id);
        deleted += 1;
      }
    }
    return { deleted, scanned: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Daily: prune contact-form submissions older than 1 year.
// Generous support-ticket retention window.
// ---------------------------------------------------------------------------
export const pruneOldContactMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - CONTACT_MESSAGES_TTL_MS;
    const rows = await ctx.db.query("contactMessages").collect();
    let deleted = 0;
    for (const r of rows) {
      if (deleted >= PRUNE_BATCH_LIMIT) break;
      if (r.createdAt < cutoff) {
        await ctx.db.delete(r._id);
        deleted += 1;
      }
    }
    return { deleted, scanned: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Daily: defensively clear expired reset codes and verification tokens.
// Success paths in convex/auth.ts already clear these immediately, but if a
// user requests a code and never uses it, the row will sit with stale data
// until they request another. Wipe past-expiry rows.
// ---------------------------------------------------------------------------
export const pruneExpiredAuthTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    let cleared = 0;
    for (const u of users) {
      const patch: Record<string, undefined> = {};
      if (u.resetCodeExpiry !== undefined && u.resetCodeExpiry < now) {
        patch.resetCode = undefined;
        patch.resetCodeExpiry = undefined;
      }
      if (u.verificationTokenExpiry !== undefined && u.verificationTokenExpiry < now) {
        patch.verificationToken = undefined;
        patch.verificationTokenExpiry = undefined;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(u._id, patch as any);
        cleared += 1;
      }
    }
    return { cleared, scanned: users.length };
  },
});
