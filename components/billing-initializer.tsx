'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { initializeBilling, setBillingContext } from '@/lib/googlePlayBilling';

/**
 * Initializes Google Play Billing once when the native app boots: registers
 * products and connects to the store so the first tap of a subscribe / buy
 * button launches the purchase sheet without a cold-start delay.
 *
 * Also binds the signed-in user + Convex granter BEFORE the store connects,
 * so `approved` events replayed at startup (purchases that were charged but
 * never granted — e.g. the app closed mid-purchase) are validated, granted,
 * and finished instead of sitting unacknowledged until Google refunds them.
 *
 * No-op on the web — `initializeBilling()` itself guards on the native check,
 * but we also skip the dynamic plugin import entirely here to keep web bundles
 * free of any Cordova references.
 */
export function BillingInitializer() {
  const validateAndGrant = useAction(api.googlePlayBilling.validateAndGrant);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const userId = localStorage.getItem('nourish_user_id');
    const userEmail = localStorage.getItem('nourish_user_email') ?? '';
    if (userId && userId !== 'guest' && userId.length >= 10) {
      setBillingContext(validateAndGrant, { userId, customerEmail: userEmail });
    }

    initializeBilling().catch((err) =>
      console.warn('[BillingInitializer] initializeBilling failed:', err),
    );
  }, [validateAndGrant]);

  return null;
}
