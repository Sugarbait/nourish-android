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

// Initialise Stripe at module level so the connection is reused across
// invocations. Guard against missing key — Convex will surface the error
// clearly rather than a cryptic "tried N times" retry message.
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.error("[stripeActions] STRIPE_SECRET_KEY is not set in Convex environment variables.");
}

function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY in the Convex dashboard under Settings → Environment Variables.");
  }
  return stripe;
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
      const client = getStripe();

      const priceId = STRIPE_PRICES[args.priceKey];
      if (!priceId) return { url: null, error: `Unknown price key: ${args.priceKey}` };

      const mode = args.priceKey === "subscription" ? "subscription" : "payment";

      const session = await client.checkout.sessions.create({
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: args.successUrl,
        cancel_url:  args.cancelUrl,
        ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
        ...(args.userId        ? { client_reference_id: args.userId }   : {}),
      });

      console.log(`[stripeActions] Checkout session created: ${session.id}`);
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
    try {
      const client = getStripe();

      const session = await client.billingPortal.sessions.create({
        customer:   args.stripeCustomerId,
        return_url: args.returnUrl,
      });

      console.log(`[stripeActions] Billing portal session created for customer: ${args.stripeCustomerId}`);
      return { url: session.url };
    } catch (err: any) {
      console.error("[stripeActions] getBillingPortalUrl error:", err.message);
      throw new Error(`Failed to open billing portal: ${err.message}`);
    }
  },
});
