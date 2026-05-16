"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Validate user-supplied redirect URLs against the APP_URL allowlist (comma-separated origins).
function isAllowedRedirect(url: string | undefined | null): boolean {
  if (!url) return false;
  const allowed = (process.env.APP_URL ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return false;
  try {
    const parsed = new URL(url);
    return allowed.some(origin => {
      try { return parsed.origin === new URL(origin).origin; } catch { return false; }
    });
  } catch {
    return false;
  }
}

// Price IDs
const STRIPE_PRICES: Record<string, string> = {
  subscription:        "price_1TRNFt2aieB6RS0mySbIRdhI", // $8.99/month
  subscription_yearly: "price_1TRNIw2aieB6RS0mkVaiTzk0", // $54.99/year
  starter:             "price_1TRNHJ2aieB6RS0mAbOIFhUu", // $1.99
  value:               "price_1TRNLA2aieB6RS0mNHGMJBQf", // $4.99
  pro:                 "price_1TRNne2aieB6RS0mnroiTobX", // $9.99
};

/** Create a Stripe Checkout Session using plain fetch (no SDK) */
export const createCheckoutSession = action({
  args: {
    priceKey:      v.string(),
    successUrl:    v.string(),
    cancelUrl:     v.string(),
    userId:        v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ url: string | null; error?: string }> => {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return { url: null, error: "STRIPE_SECRET_KEY not set in Convex environment." };

      const priceId = STRIPE_PRICES[args.priceKey];
      if (!priceId) return { url: null, error: `Unknown price key: ${args.priceKey}` };

      if (!isAllowedRedirect(args.successUrl) || !isAllowedRedirect(args.cancelUrl)) {
        return { url: null, error: "Invalid redirect URL" };
      }

      const mode = args.priceKey.startsWith("subscription") ? "subscription" : "payment";

      const params = new URLSearchParams({
        mode,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: args.successUrl,
        cancel_url:  args.cancelUrl,
        "metadata[priceKey]": args.priceKey,
      });
      if (args.customerEmail) params.set("customer_email", args.customerEmail);
      if (args.userId)        params.set("client_reference_id", args.userId);

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        console.error("[stripeActions] Stripe API error:", data.error?.message);
        return { url: null, error: data.error?.message || "Stripe API error" };
      }

      console.log("[stripeActions] Checkout session created:", data.id);
      return { url: data.url };
    } catch (err: any) {
      console.error("[stripeActions] createCheckoutSession error:", err.message);
      return { url: null, error: err.message };
    }
  },
});

/** Create a Stripe Billing Portal session using plain fetch (no SDK) */
export const getBillingPortalUrl = action({
  args: {
    stripeCustomerId: v.string(),
    returnUrl:        v.string(),
  },
  handler: async (_ctx, args): Promise<{ url: string }> => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY not set in Convex environment.");

    if (!isAllowedRedirect(args.returnUrl)) {
      throw new Error("Invalid returnUrl");
    }

    const params = new URLSearchParams({
      customer:   args.stripeCustomerId,
      return_url: args.returnUrl,
    });

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to create billing portal session");
    }

    console.log("[stripeActions] Billing portal session created for:", args.stripeCustomerId);
    return { url: data.url };
  },
});
