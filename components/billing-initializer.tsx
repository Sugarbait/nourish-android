'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { initializeBilling } from '@/lib/googlePlayBilling';

/**
 * Initializes Google Play Billing once when the native app boots: registers
 * products and connects to the store so the first tap of a subscribe / buy
 * button launches the purchase sheet without a cold-start delay.
 *
 * No-op on the web — `initializeBilling()` itself guards on the native check,
 * but we also skip the dynamic plugin import entirely here to keep web bundles
 * free of any Cordova references.
 */
export function BillingInitializer() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    initializeBilling().catch((err) =>
      console.warn('[BillingInitializer] initializeBilling failed:', err),
    );
  }, []);

  return null;
}
