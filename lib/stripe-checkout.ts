import { loadStripe } from '@stripe/stripe-js';

// Stripe price IDs
export const STRIPE_PRICES = {
  subscription: 'price_1TIBSQJodftDQSSFFtgp0U7r', // $3.99/month
  starter:      'price_1TIBVLJodftDQSSFfLLMr6QE', // $1.99 one-time
  value:        'price_1TIBY2JodftDQSSFXF5N9ZLn', // $4.99 one-time
  pro:          'price_1TIBd9JodftDQSSFGsriUBlI', // $9.99 one-time
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

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
  const stripe = await getStripe();
  if (!stripe) {
    console.error('Stripe failed to load');
    return;
  }

  const mode = priceKey === 'subscription' ? 'subscription' : 'payment';
  const successUrl = `${window.location.origin}/?checkout=success`;
  const cancelUrl  = `${window.location.origin}/`;

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: STRIPE_PRICES[priceKey], quantity: 1 }],
    mode,
    successUrl,
    cancelUrl,
    ...(options.customerEmail ? { customerEmail: options.customerEmail } : {}),
    ...(options.userId        ? { clientReferenceId: options.userId }     : {}),
  });

  if (error) {
    console.error('Stripe checkout error:', error.message);
  }
}
