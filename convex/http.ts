import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import { api } from "./_generated/api";

// Module-level Stripe singleton — created once, reused across all HTTP handlers.
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
} else {
  console.error("[http] STRIPE_SECRET_KEY is not set in Convex environment variables.");
}

const http = httpRouter();

// ---------------------------------------------------------------------------
// POST /stripe-webhook
// Stripe sends signed events here. Register this URL in your Stripe dashboard:
//   https://insightful-ox-840.convex.cloud/stripe-webhook
//
// Required Convex environment variables:
//   STRIPE_SECRET_KEY      — sk_live_... key
//   STRIPE_WEBHOOK_SECRET  — whsec_... from the Stripe webhook endpoint page
// ---------------------------------------------------------------------------
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret   = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      console.error("[stripe-webhook] Missing env vars");
      return new Response("Server misconfiguration", { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await req.text();
    if (!stripe) return new Response("Stripe not initialised", { status: 500 });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId          = session.client_reference_id ?? "";
      const customerEmail   = session.customer_details?.email ?? session.customer_email ?? "";
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;

      if (session.mode === "subscription") {
        await ctx.runMutation(api.stripe.activateSubscription, {
          userId,
          customerEmail,
          stripeCustomerId,
        });
        console.log("[stripe-webhook] Subscription activated for", customerEmail);
      } else if (session.mode === "payment" && session.amount_total) {
        await ctx.runMutation(api.stripe.addCreditPack, {
          userId,
          customerEmail,
          amountTotal: session.amount_total,
          stripeCustomerId,
        });
        console.log("[stripe-webhook] Credits added for", customerEmail, "amount:", session.amount_total);
      }
    }

    // Subscription cancelled / expired
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        await ctx.runMutation(api.stripe.deactivateSubscription, { stripeCustomerId: customerId });
        console.log("[stripe-webhook] Subscription cancelled for customer", customerId);
      }
    }

    // Monthly renewal — add 40 credits for the new billing period.
    // Skips the very first invoice (billing_reason === 'subscription_create')
    // because checkout.session.completed already handled that one.
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = invoice.billing_reason;
      const customerId    = typeof invoice.customer === "string" ? invoice.customer : null;

      if (customerId && billingReason === "subscription_cycle") {
        // Extend expiry by 30 days from now and add 40 renewal credits
        await ctx.runMutation(api.stripe.renewSubscription, { stripeCustomerId: customerId });
        console.log("[stripe-webhook] Subscription renewed for customer", customerId);
      }
    }

    // Renewal payment failed — log the event but do NOT deactivate immediately.
    // Stripe's dunning process will retry the charge automatically (typically 3–4 times
    // over several days). We only deactivate once Stripe gives up and fires
    // customer.subscription.deleted, which is already handled above.
    if (event.type === "invoice.payment_failed") {
      const invoice    = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      console.log("[stripe-webhook] Payment failed (will retry via dunning) for customer", customerId);
    }

    return new Response(null, { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// POST /stripe-portal
// Creates a Stripe Billing Portal session for the user so they can manage
// their subscription (cancel, update card, view invoices).
//
// Body: { userId: string, returnUrl: string }
// Returns: { url: string }
// ---------------------------------------------------------------------------
http.route({
  path: "/stripe-portal",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response("Server misconfiguration", { status: 500 });
    }

    let body: { userId?: string; returnUrl?: string };
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { userId, returnUrl } = body;
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // Look up the Stripe customer ID from Convex
    const stripeCustomerId = await ctx.runQuery(api.stripe.getStripeCustomerId, { userId });

    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found. Please contact support." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!stripe) return new Response("Stripe not initialised", { status: 500 });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl ?? "https://insightful-ox-840.convex.cloud",
    });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

// ---------------------------------------------------------------------------
// POST /stripe-checkout
// Creates a Stripe Checkout Session server-side and returns the hosted URL.
//
// Body: { priceId: string, mode: 'payment'|'subscription', userId?: string,
//         customerEmail?: string, successUrl: string, cancelUrl: string }
// Returns: { url: string }
// ---------------------------------------------------------------------------
http.route({
  path: "/stripe-checkout",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    let body: { priceId?: string; mode?: string; userId?: string; customerEmail?: string; successUrl?: string; cancelUrl?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { priceId, mode, userId, customerEmail, successUrl, cancelUrl } = body;
    if (!priceId || !mode || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!stripe) return new Response(JSON.stringify({ error: "Stripe not initialised" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

    const session = await stripe.checkout.sessions.create({
      mode: mode as "payment" | "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      ...(userId ? { client_reference_id: userId } : {}),
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }),
});

http.route({
  path: "/stripe-checkout",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

// Allow CORS preflight for /stripe-portal so the browser can POST from any origin
http.route({
  path: "/stripe-portal",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
