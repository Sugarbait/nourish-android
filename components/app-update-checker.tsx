'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateResultCode,
  FlexibleUpdateInstallStatus,
} from '@capawesome/capacitor-app-update';

const RETRY_DELAYS_MS = [0, 3000, 10000]; // initial, +3s, +10s — gives Play Store cache time to warm up

/**
 * Checks Google Play for app updates on launch and on resume, then drives
 * Google's **flexible** in-app update flow directly. The flexible flow shows
 * Google's own lightweight consent prompt (a bottom sheet) rather than the
 * full-screen takeover of the immediate flow — less intrusive, and the download
 * happens in the background. There is no custom dialog: Google Play shows its
 * own UI, so the user sees exactly one prompt (Google's). When the download
 * finishes we call `completeFlexibleUpdate()`, which lets Google install and
 * restart the app.
 *
 * No-op on web / iOS. Renders nothing — all UI is Google's.
 */
export function AppUpdateChecker() {
  const triggeringRef = useRef(false);
  const dismissedRef = useRef(false);
  const completingRef = useRef(false);
  const appStateListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const flexStateListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const retryTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    const clearRetries = () => {
      retryTimersRef.current.forEach((t) => clearTimeout(t));
      retryTimersRef.current = [];
    };

    // Install + restart once the flexible update has finished downloading.
    const completeUpdate = async () => {
      if (completingRef.current) return;
      completingRef.current = true;
      try {
        await AppUpdate.completeFlexibleUpdate();
      } catch (err) {
        console.warn('[AppUpdate] completeFlexibleUpdate failed:', err);
        completingRef.current = false;
      }
    };

    const triggerFlexibleUpdate = async () => {
      if (triggeringRef.current) return;
      triggeringRef.current = true;
      clearRetries();
      try {
        // Launches Google's flexible update consent (bottom sheet) and begins a
        // background download. Progress/completion arrives via the state listener.
        const result = await AppUpdate.startFlexibleUpdate();
        if (result.code === AppUpdateResultCode.CANCELED) {
          // User backed out — don't loop; we'll re-offer next time they foreground.
          dismissedRef.current = true;
        }
      } catch (err) {
        console.warn('[AppUpdate] startFlexibleUpdate failed:', err);
        dismissedRef.current = true;
      } finally {
        triggeringRef.current = false;
      }
    };

    const singleCheck = async () => {
      if (dismissedRef.current || triggeringRef.current || completingRef.current) return;
      try {
        const info = await AppUpdate.getAppUpdateInfo();
        console.log('[AppUpdate] getAppUpdateInfo:', JSON.stringify(info));

        // A flexible update already finished downloading (e.g. during a previous
        // session) — just install it.
        if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
          await completeUpdate();
          return;
        }

        if (
          info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE &&
          info.flexibleUpdateAllowed !== false
        ) {
          await triggerFlexibleUpdate();
        }
      } catch (err) {
        console.warn('[AppUpdate] check failed:', err);
      }
    };

    // Staggered checks so Play Store has time to refresh its cached metadata.
    const runChecks = () => {
      clearRetries();
      RETRY_DELAYS_MS.forEach((delay) => {
        const id = window.setTimeout(singleCheck, delay);
        retryTimersRef.current.push(id);
      });
    };

    // Install the moment the background download completes.
    (async () => {
      flexStateListenerRef.current = await AppUpdate.addListener(
        'onFlexibleUpdateStateChange',
        (state) => {
          if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
            void completeUpdate();
          }
        },
      );
    })();

    // Initial round on launch.
    runChecks();

    // Re-check whenever the app returns to the foreground.
    (async () => {
      appStateListenerRef.current = await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          dismissedRef.current = false;
          runChecks();
        }
      });
    })();

    return () => {
      clearRetries();
      appStateListenerRef.current?.remove().catch(() => {});
      flexStateListenerRef.current?.remove().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
