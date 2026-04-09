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
    await ctx.runAction(internal.contact.sendContactEmailInternal, {
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

import { internalAction } from "./_generated/server";
import nodemailer from "nodemailer";

export const sendContactEmailInternal = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    app: v.string(),
  },
  handler: async (_ctx, { name, email, message, app }) => {
    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    if (!host || !user || !pass) {
      console.warn("SMTP credentials not set. Skipping email delivery.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
    .label { font-weight: bold; color: #666; margin-top: 15px; }
    .value { margin-bottom: 15px; }
    .message-box { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Contact Form Submission</h2>
      <p>App: <strong>${app}</strong></p>
    </div>
    <div class="label">From:</div>
    <div class="value">${name} (&lt;${email}&gt;)</div>
    
    <div class="label">Message:</div>
    <div class="message-box">
      ${message.replace(/\n/g, '<br>')}
    </div>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px;">
      This is an automated notification.
    </p>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Nourish Contact Form" <${user}>`,
      to: "contactus@digitalac.app",
      replyTo: email,
      subject: `New Message from ${name} via ${app}`,
      html,
    });
  },
});
