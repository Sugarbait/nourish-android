'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Hides the native splash screen once React has mounted. Splash is configured
 * with launchAutoHide=false so the brand splash stays visible until the
 * Next.js app is fully rendered (no flash of white WebView).
 */
export function SplashHider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Small delay so the first paint completes before fading out the splash.
    const t = setTimeout(() => {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch((err) => console.warn('SplashScreen.hide failed:', err));
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return null;
}
