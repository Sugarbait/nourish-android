"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";

const SITE_URL = "https://nourishai.digitalac.app";

export const sendVerificationEmail = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, { email, name, token }): Promise<{ success: boolean }> => {
    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

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
                  <td style="width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <img src="${SITE_URL}/logo-icon.png" width="36" height="36" alt="Nourish Logo" style="display:block;width:36px;height:36px;object-fit:contain;border-radius:10px;" />
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:15px;font-weight:700;color:#f5f5f5;letter-spacing:-0.3px;">Nourish</span>
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

    await transporter.sendMail({
      from: `"Nourish" <${user}>`,
      to: email,
      subject: "Verify your Nourish account",
      html,
    });

    return { success: true };
  },
});
