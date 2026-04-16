import { action, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const submitContactForm = action({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    app: v.string(),
  },
  handler: async (ctx, { name, email, message, app }) => {
    // 1. Store in DB
    await ctx.runMutation(internal.contact.storeContactMessage, {
      name,
      email,
      message,
      app,
    });

    // 2. Send email notification
    await ctx.runAction(internal.emails.sendContactEmailInternal, {
      name,
      email,
      message,
      app,
    });

    return { success: true };
  },
});

export const storeContactMessage = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    app: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contactMessages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

