"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";

type AuthResult = { userId: string; name: string | null; avatarUrl: string | null };

/** Sign in with email + password. Returns { userId, name, avatarUrl } */
export const loginUser: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }): Promise<AuthResult> => {
    const user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email });
    if (!user) throw new Error("Invalid email or password.");
    if (!user.passwordHash) throw new Error("This account uses social login. Please sign in with Google or Microsoft.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid email or password.");

    if (user.emailVerified === false) {
      throw new Error("Please verify your email before signing in. Check your inbox for the verification link.");
    }

    return {
      userId: user._id as unknown as string,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  },
});

/** Create a new account with email + password. Returns { userId, pendingVerification: true } */
export const createAccount: ReturnType<typeof action> = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { name, email, password }): Promise<{ userId: string; pendingVerification: boolean }> => {
    const existing = await ctx.runQuery(internal.authInternal.getUserByEmail, { email });
    if (existing) throw new Error("This email already exists. Please log in or use another email address to sign up.");

    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    const userId = await ctx.runMutation(internal.authInternal.createUser, {
      email,
      name,
      passwordHash,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });

    await ctx.runAction(internal.emails.sendVerificationEmail, {
      email,
      name,
      token: verificationToken,
    });

    return { userId: userId as unknown as string, pendingVerification: true };
  },
});

/** Upsert an OAuth user. Returns { userId, name, avatarUrl } */
export const createOrUpdateOAuthUser: ReturnType<typeof action> = action({
  args: {
    provider: v.string(),
    providerId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { provider, providerId, email, name, avatarUrl }): Promise<AuthResult> => {
    const byOAuth = await ctx.runQuery(internal.authInternal.getUserByOAuth, {
      authProvider: provider,
      oauthProviderId: providerId,
    });

    if (byOAuth) {
      await ctx.runMutation(internal.authInternal.updateOAuthUser, {
        userId: byOAuth._id,
        name,
        avatarUrl,
      });
      return {
        userId: byOAuth._id as unknown as string,
        name: name ?? byOAuth.name ?? null,
        avatarUrl: avatarUrl ?? byOAuth.avatarUrl ?? null,
      };
    }

    const byEmail = await ctx.runQuery(internal.authInternal.getUserByEmail, { email });
    if (byEmail) {
      await ctx.runMutation(internal.authInternal.updateOAuthUser, {
        userId: byEmail._id,
        name: name ?? byEmail.name,
        avatarUrl: avatarUrl ?? byEmail.avatarUrl,
      });
      return {
        userId: byEmail._id as unknown as string,
        name: name ?? byEmail.name ?? null,
        avatarUrl: avatarUrl ?? byEmail.avatarUrl ?? null,
      };
    }

    const userId = await ctx.runMutation(internal.authInternal.createUser, {
      email,
      name,
      authProvider: provider,
      oauthProviderId: providerId,
      avatarUrl,
    });

    return { userId: userId as unknown as string, name: name ?? null, avatarUrl: avatarUrl ?? null };
  },
});

/** Request a password reset — sends a 6-digit code to the user's email. */
export const requestPasswordReset: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ sent: boolean }> => {
    const user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email });
    if (!user) throw new Error("No account found with that email address.");
    if (!user.passwordHash) throw new Error("This account uses social login (Google or Microsoft) and does not have a password.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 1000 * 60 * 30; // 30 minutes

    await ctx.runMutation(internal.authInternal.updateUserResetCode, {
      userId: user._id,
      resetCode: code,
      resetCodeExpiry: expiry,
    });

    await ctx.runAction(internal.emails.sendPasswordResetEmail, {
      email,
      name: user.name ?? email,
      code,
    });

    return { sent: true };
  },
});

/** Verify reset code and set new password. */
export const resetPassword: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }): Promise<{ success: boolean }> => {
    const user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email });
    if (!user) throw new Error("No account found with that email address.");
    if (!user.resetCode || user.resetCode !== code) throw new Error("Invalid or expired reset code.");
    if (user.resetCodeExpiry && user.resetCodeExpiry < Date.now()) throw new Error("Reset code has expired. Please request a new one.");

    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await ctx.runMutation(internal.authInternal.updateUserPassword, {
      userId: user._id,
      passwordHash,
    });

    return { success: true };
  },
});
