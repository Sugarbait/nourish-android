"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

// Price IDs
const STRIPE_PRICES: Record<string, string> = {
  subscription: "price_1TIBSQJodftDQSSFFtgp0U7r",
  starter:      "price_1TIBVLJodftDQSSFfLLMr6QE",
  value:        "price_1TIBY2JodftDQSSFXF5N9ZLn",
  pro:          "price_1TIBd9JodftDQSSFGsriUBlI",
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Convex environment variables.");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

/** Create a Stripe Checkout Session and return its URL */
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
      const stripe = getStripe();

      const priceId = STRIPE_PRICES[args.priceKey];
      if (!priceId) return { url: null, error: `Unknown price key: ${args.priceKey}` };

      const mode = args.priceKey === "subscription" ? "subscription" : "payment";

      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: args.successUrl,
        cancel_url:  args.cancelUrl,
        ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
        ...(args.userId        ? { client_reference_id: args.userId }   : {}),
      });

      return { url: session.url };
    } catch (err: any) {
      console.error("[stripeActions] createCheckoutSession error:", err.message);
      return { url: null, error: err.message };
    }
  },
});

/** Create a Stripe Billing Portal session and return its URL */
export const getBillingPortalUrl = action({
  args: {
    stripeCustomerId: v.string(),
    returnUrl:        v.string(),
  },
  handler: async (_ctx, args): Promise<{ url: string }> => {
    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer:   args.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: session.url };
  },
});
