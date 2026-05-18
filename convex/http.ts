import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// Google Play Billing webhook handler placeholder
// When a purchase is completed in the native app, the client will validate
// the purchase token via the validatePurchaseToken action in googlePlayBilling.ts
//
// For future use if you want to set up server-to-server notifications:
// https://developer.android.com/google/play/billing/rtdn-reference

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
