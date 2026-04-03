// Stripe price IDs
export const STRIPE_PRICES = {
  subscription: 'price_1TIBSQJodftDQSSFFtgp0U7r', // $3.99/month
  starter:      'price_1TIBVLJodftDQSSFfLLMr6QE', // $1.99 one-time
  value:        'price_1TIBY2JodftDQSSFXF5N9ZLn', // $4.99 one-time
  pro:          'price_1TIBd9JodftDQSSFGsriUBlI', // $9.99 one-time
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;

export interface CheckoutOptions {
  /** Convex userId — passed as client_reference_id so the webhook can identify the user */
  userId?: string | null;
  /** User's email — pre-fills Stripe checkout and used as webhook fallback lookup */
  customerEmail?: string | null;
}

export async function redirectToStripeCheckout(
  priceKey: StripePriceKey,
  options: CheckoutOptions = {}
): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error('NEXT_PUBLIC_CONVEX_URL is not set');
    return;
  }

  const mode = priceKey === 'subscription' ? 'subscription' : 'payment';
  const successUrl = `${window.location.origin}/?checkout=success`;
  const cancelUrl  = `${window.location.origin}/`;

  try {
    const res = await fetch(`${convexUrl}/stripe-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: STRIPE_PRICES[priceKey],
        mode,
        successUrl,
        cancelUrl,
        ...(options.customerEmail ? { customerEmail: options.customerEmail } : {}),
        ...(options.userId        ? { userId: options.userId }               : {}),
      }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Stripe checkout error:', data.error);
    }
  } catch (err) {
    console.error('Stripe checkout fetch failed:', err);
  }
}
