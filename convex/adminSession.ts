import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { sha256Hex } from "./util/sha256";

/**
 * Server-side admin sessions.
 *
 * The admin console's real security lives here: a session token is minted by
 * `admin.adminLogin` only after the password (and TOTP, when enabled) checks
 * pass, and EVERY admin query/mutation/action requires it. Only the SHA-256
 * hash of the token is stored, so a database leak cannot be replayed as a
 * session.
 */

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Resolve a raw session token to the admin email, or null if invalid/expired. */
export async function verifySessionEmail(
  ctx: { db: any },
  sessionToken: string,
): Promise<string | null> {
  if (!sessionToken || typeof sessionToken !== "string" || sessionToken.length > 200) return null;
  let hash: string;
  try {
    hash = sha256Hex(sessionToken);
  } catch {
    return null; // non-ASCII garbage
  }
  const row = await ctx.db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", hash))
    .first();
  if (!row || row.expiresAt < Date.now()) return null;
  return row.email;
}

/** Throw unless the token maps to a live admin session. Returns the email. */
export async function requireAdminSession(
  ctx: { db: any },
  sessionToken: string,
): Promise<string> {
  const email = await verifySessionEmail(ctx, sessionToken);
  if (!email) throw new ConvexError("ADMIN_SESSION_INVALID");
  return email;
}

/** Called by the login action after both factors pass. */
export const _storeSession = internalMutation({
  args: { tokenHash: v.string(), email: v.string() },
  handler: async (ctx, { tokenHash, email }) => {
    const now = Date.now();
    await ctx.db.insert("adminSessions", {
      tokenHash,
      email,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
  },
});

/** Session check for "use node" actions (they can't read the db directly). */
export const _verifySession = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => verifySessionEmail(ctx, sessionToken),
});

/** Page-load probe: lets the admin UI bounce to sign-in when a session dies. */
export const checkSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => ({
    valid: (await verifySessionEmail(ctx, sessionToken)) !== null,
  }),
});

/** Sign out — destroys the session server-side. */
export const deleteSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    let hash: string;
    try {
      hash = sha256Hex(sessionToken);
    } catch {
      return;
    }
    const row = await ctx.db
      .query("adminSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

/** Retention cron target: drop expired sessions. */
export const _pruneExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("adminSessions").collect();
    let pruned = 0;
    for (const r of rows) {
      if (r.expiresAt < now) {
        await ctx.db.delete(r._id);
        pruned++;
      }
    }
    return { pruned };
  },
});
