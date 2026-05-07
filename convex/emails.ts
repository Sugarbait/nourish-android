"use node";


import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";

const SITE_URL = process.env.SITE_URL || "https://nourish.neoncell.ca";

export const sendVerificationEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, { email, name, token }): Promise<{ success: boolean }> => {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const user = process.env.SMTP_USER || "no-reply@neoncell.ca";
    const pass = process.env.SMTP_PASS;

    if (!pass) {
      throw new Error("[emails] SMTP_PASS env var is not set in Convex. Cannot send verification email.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const verifyUrl = `${SITE_URL}/verify-email/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const firstName = name.split(" ")[0] || name;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Nourish account</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
          <!-- Top gradient bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981,#14b8a6);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${SITE_URL}/logo.png" height="36" alt="Nourish Logo" style="display:block;height:36px;width:auto;object-fit:contain;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 36px 36px;">
              <p style="margin:0 0 6px;font-size:12px;color:#525252;">${email}</p>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f5f5f5;letter-spacing:-0.4px;">Verify your email</h1>
              <p style="margin:0 0 20px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Hi ${firstName}, welcome to Nourish! Click the button below to verify your email address and activate your account.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#14b8a6);border-radius:10px;">
                    <a href="${verifyUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.1px;">
                      Verify my account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#737373;line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:11px;color:#10b981;word-break:break-all;line-height:1.5;">
                ${verifyUrl}
              </p>
              <p style="margin:0;font-size:12px;color:#525252;line-height:1.6;">
                This link expires in <strong style="color:#737373;">24 hours</strong>. If you didn't create a Nourish account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:11px;color:#404040;text-align:center;">
                &copy; ${new Date().getFullYear()} Nourish &mdash; Your personal nutrition companion
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: `"Nourish" <${user}>`,
        to: email,
        subject: "Verify your Nourish account",
        html,
      });
    } catch (error) {
      throw new Error(`Verification email delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { success: true };
  },
});

export const sendPasswordResetEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    code: v.string(),
  },
  handler: async (_ctx, { email, name, code }): Promise<{ success: boolean }> => {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const user = process.env.SMTP_USER || "no-reply@neoncell.ca";
    const pass = process.env.SMTP_PASS;

    if (!pass) {
      throw new Error("[emails] SMTP_PASS env var is not set in Convex. Cannot send password reset email.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const firstName = name.split(" ")[0] || name;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Nourish password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
          <!-- Top gradient bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981,#14b8a6);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${SITE_URL}/logo.png" height="36" alt="Nourish Logo" style="display:block;height:36px;width:auto;object-fit:contain;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 36px 36px;">
              <p style="margin:0 0 6px;font-size:12px;color:#525252;">${email}</p>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f5f5f5;letter-spacing:-0.4px;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Hi ${firstName}, use the code below to reset your Nourish password. This code expires in <strong style="color:#f5f5f5;">30 minutes</strong>.
              </p>
              <!-- Code block -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;width:100%;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;padding:18px 36px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;">
                      <span style="font-size:32px;font-weight:800;letter-spacing:10px;color:#10b981;font-variant-numeric:tabular-nums;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#525252;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:11px;color:#404040;text-align:center;">
                &copy; ${new Date().getFullYear()} Nourish &mdash; Your personal nutrition companion
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: `"Nourish" <${user}>`,
        to: email,
        subject: "Your Nourish password reset code",
        html,
      });
    } catch (error) {
      throw new Error(`Email delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { success: true };
  },
});

export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (_ctx, { email, name }): Promise<{ success: boolean }> => {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const user = process.env.SMTP_USER || "no-reply@neoncell.ca";
    const pass = process.env.SMTP_PASS;

    if (!pass) {
      throw new Error("[emails] SMTP_PASS env var is not set in Convex. Cannot send welcome email.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const firstName = name.split(" ")[0] || name;
    const dashboardUrl = `${SITE_URL}/dashboard`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Nourish!</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
          <!-- Top gradient bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981,#14b8a6);"></td>
          </tr>
          <!-- Header with logo -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <img src="${SITE_URL}/logo.png" height="36" alt="Nourish Logo" style="display:block;height:36px;width:auto;object-fit:contain;" />
            </td>
          </tr>
          <!-- Hero -->
          <tr>
            <td style="padding:0 36px 28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#525252;">${email}</p>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#f5f5f5;letter-spacing:-0.4px;">Welcome to Nourish, ${firstName}! 🎉</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.7;">
                Your account is all set. We're thrilled to have you on board. Nourish is your personal AI-powered nutrition companion — here to help you track meals, hit your goals, and build healthier habits every day.
              </p>
              <!-- What you can do -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;background:#1a1a1a;border-radius:12px;border:1px solid #262626;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#f5f5f5;letter-spacing:0.2px;">Here's what you can do with Nourish:</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                          <span style="color:#10b981;margin-right:8px;">✓</span> Log meals with AI — just describe what you ate
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                          <span style="color:#10b981;margin-right:8px;">✓</span> Track calories, protein, carbs & fat automatically
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                          <span style="color:#10b981;margin-right:8px;">✓</span> Set custom nutrition goals tailored to you
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                          <span style="color:#10b981;margin-right:8px;">✓</span> Chat with your AI nutrition coach anytime
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                          <span style="color:#10b981;margin-right:8px;">✓</span> Monitor your daily water intake
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#14b8a6);border-radius:10px;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.1px;">
                      Start Tracking Now →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:11px;color:#404040;text-align:center;">
                &copy; ${new Date().getFullYear()} Nourish &mdash; Your personal nutrition companion
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: `"Nourish" <${user}>`,
        to: email,
        subject: `Welcome to Nourish, ${firstName}! 🎉`,
        html,
      });
    } catch (error) {
      throw new Error(`Welcome email delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { success: true };
  },
});

export const sendContactEmailInternal = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    app: v.string(),
  },
  handler: async (_ctx, { name, email, message, app }) => {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const user = process.env.SMTP_CONTACT_USER || "contactus@neoncell.ca";
    const pass = process.env.SMTP_CONTACT_PASS || process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.error("[emails] SMTP credentials not fully set for contact form.");
      throw new Error("Email service is not properly configured. Please try again later.");
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

    try {
      await transporter.sendMail({
        from: `"Nourish Contact Form" <${user}>`,
        to: "contactus@neoncell.ca",
        replyTo: email,
        subject: `New Message from ${name} via ${app}`,
        html,
      });
      console.log(`[emails] Contact form message sent from ${email}`);
    } catch (error) {
      console.error("[emails] Failed to send contact form email:", error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});
