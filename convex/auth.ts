"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
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
    const trimmedEmail = email.trim();
    let user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail });
    if (!user) {
      user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail.toLowerCase() });
    }
    if (!user) throw new ConvexError("Invalid email or password.");
    if (!user.passwordHash) throw new ConvexError("This account uses social login. Please sign in with Google or Microsoft.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ConvexError("Invalid email or password.");

    if (user.emailVerified === false) {
      throw new ConvexError("Please verify your email before signing in. Check your inbox for the verification link.");
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
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: normalizedEmail });
    if (existing) throw new ConvexError("This email already exists. Please log in or use another email address to sign up.");

    if (password.length < 8) throw new ConvexError("Password must be at least 8 characters.");

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    const userId = await ctx.runMutation(internal.authInternal.createUser, {
      email: normalizedEmail,
      name,
      passwordHash,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });

    try {
      await ctx.runAction(internal.emails.sendVerificationEmail, {
        email: normalizedEmail,
        name,
        token: verificationToken,
      });
    } catch (emailError) {
      console.error("[auth] Failed to send verification email:", emailError);
      // Continue anyway - user can still verify later by requesting a new email
    }

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
    const normalizedEmail = email.trim().toLowerCase();

    const byOAuth = await ctx.runQuery(internal.authInternal.getUserByOAuth, {
      authProvider: provider,
      oauthProviderId: providerId,
    });

    if (byOAuth) {
      await ctx.runMutation(internal.authInternal.updateOAuthUser, {
        userId: byOAuth._id,
        name,
        avatarUrl,
        // Let's ensure the email is normalized on update too if we had an oauthEmail field, 
        // but since we don't, we skip it.
      });
      return {
        userId: byOAuth._id as unknown as string,
        name: name ?? byOAuth.name ?? null,
        avatarUrl: avatarUrl ?? byOAuth.avatarUrl ?? null,
      };
    }

    let byEmail = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: email.trim() });
    if (!byEmail) byEmail = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: normalizedEmail });
    
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
      email: normalizedEmail,
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
    const trimmedEmail = email.trim();
    let user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail });
    if (!user) {
      user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail.toLowerCase() });
    }
    if (!user) throw new ConvexError("No email exists in the system. Please check the spelling or try a different email address.");
    if (!user.passwordHash) throw new ConvexError("This account uses social login (Google or Microsoft) and does not have a password.");

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
    const trimmedEmail = email.trim();
    let user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail });
    if (!user) {
      user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: trimmedEmail.toLowerCase() });
    }
    if (!user) throw new ConvexError("No email exists in the system. Please check the spelling or try a different email address.");
    if (!user.resetCode || user.resetCode !== code.trim()) throw new ConvexError("Invalid or expired reset code.");
    if (user.resetCodeExpiry && user.resetCodeExpiry < Date.now()) throw new ConvexError("Reset code has expired. Please request a new one.");

    if (newPassword.length < 8) throw new ConvexError("Password must be at least 8 characters.");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await ctx.runMutation(internal.authInternal.updateUserPassword, {
      userId: user._id,
      passwordHash,
    });

    // The user proved email ownership by entering the correct reset code,
    // so mark their email as verified (unblocks login for users who never
    // clicked the original verification link).
    if (user.emailVerified === false) {
      await ctx.runMutation(internal.authInternal.updateUserVerification, {
        userId: user._id,
        emailVerified: true,
        verificationToken: undefined,
        verificationTokenExpiry: undefined,
      });
    }

    return { success: true };
  },
});

/** Resend the verification email to a user */
export const resendVerificationEmail: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ sent: boolean }> => {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await ctx.runQuery(internal.authInternal.getUserByEmail, { email: normalizedEmail });
    if (!user) throw new ConvexError("No account found with this email address.");

    // If already verified, no need to resend
    if (user.emailVerified === true) {
      throw new ConvexError("This email is already verified. You can sign in now.");
    }

    // Generate a new verification token
    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    await ctx.runMutation(internal.authInternal.updateUserVerification, {
      userId: user._id,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });

    try {
      await ctx.runAction(internal.emails.sendVerificationEmail, {
        email: normalizedEmail,
        name: user.name || email,
        token: verificationToken,
      });
    } catch (emailError) {
      console.error("[auth] Failed to resend verification email:", emailError);
      throw new ConvexError("Failed to send email. Please try again later.");
    }

    return { sent: true };
  },
});
