"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Price IDs
const STRIPE_PRICES: Record<string, string> = {
  subscription:        "price_1TIBSQJodftDQSSFFtgp0U7r",
  subscription_yearly: "REPLACE_WITH_YEARLY_STRIPE_PRICE_ID",
  starter:             "price_1TIBVLJodftDQSSFfLLMr6QE",
  value:               "price_1TIBY2JodftDQSSFXF5N9ZLn",
  pro:                 "price_1TIBd9JodftDQSSFGsriUBlI",
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

      const mode = args.priceKey.startsWith("subscription") ? "subscription" : "payment";

      const params = new URLSearchParams({
        mode,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: args.successUrl,
        cancel_url:  args.cancelUrl,
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
