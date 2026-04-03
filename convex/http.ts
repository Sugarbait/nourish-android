import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import { api } from "./_generated/api";

const http = httpRouter();

// ---------------------------------------------------------------------------
// POST /stripe-webhook
// Stripe sends signed events here. Register this URL in your Stripe dashboard:
//   https://insightful-ox-840.convex.cloud/stripe-webhook
//
// Required Convex environment variables (set via Convex dashboard or CLI):
//   STRIPE_SECRET_KEY      — your sk_live_... key
//   STRIPE_WEBHOOK_SECRET  — whsec_... from the Stripe webhook endpoint page
// ---------------------------------------------------------------------------
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      console.error("[stripe-webhook] Missing env vars STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response("Server misconfiguration", { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await req.text();

    // Verify the webhook signature
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.client_reference_id ?? "";
      const customerEmail =
        session.customer_details?.email ?? session.customer_email ?? "";

      if (session.mode === "subscription") {
        // $3.99/month — activate subscription and add 40 credits
        await ctx.runMutation(api.stripe.activateSubscription, {
          userId,
          customerEmail,
        });
        console.log("[stripe-webhook] Subscription activated for", customerEmail);
      } else if (session.mode === "payment" && session.amount_total) {
        // One-time credit pack — amount_total determines the pack
        await ctx.runMutation(api.stripe.addCreditPack, {
          userId,
          customerEmail,
          amountTotal: session.amount_total,
        });
        console.log("[stripe-webhook] Credits added for", customerEmail, "amount:", session.amount_total);
      }
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
