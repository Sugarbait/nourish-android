'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  AppUpdate,
  AppUpdateAvailability,
  FlexibleUpdateInstallStatus,
} from '@capawesome/capacitor-app-update';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, RotateCw } from 'lucide-react';

const RETRY_DELAYS_MS = [0, 3000, 10000]; // initial, +3s, +10s — gives Play Store cache time to warm up

/**
 * Checks Google Play for app updates on launch, on resume, and via several
 * retries with delays (Play Store update metadata is cached up to 24h and
 * sometimes takes a few seconds to refresh after the app opens).
 *
 * Persistent modal so users can't miss it; no-op on web / iOS.
 */
export function AppUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const appStateListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const dismissedRef = useRef(false);
  const retryTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    const clearRetries = () => {
      retryTimersRef.current.forEach((t) => clearTimeout(t));
      retryTimersRef.current = [];
    };

    const singleCheck = async () => {
      if (dismissedRef.current || downloaded || updateAvailable) return;
      try {
        const info = await AppUpdate.getAppUpdateInfo();
        console.log('[AppUpdate] getAppUpdateInfo:', JSON.stringify(info));

        // Handle a previously-started update that's resumed mid-flow.
        if (info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS) {
          setUpdateAvailable(true);
          clearRetries();
          return;
        }

        if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && info.flexibleUpdateAllowed !== false) {
          setUpdateAvailable(true);
          clearRetries();
        }
      } catch (err) {
        console.warn('[AppUpdate] check failed:', err);
      }
    };

    // Run several staggered checks so Play Store has time to refresh its metadata.
    const runChecks = () => {
      clearRetries();
      RETRY_DELAYS_MS.forEach((delay) => {
        const id = window.setTimeout(singleCheck, delay);
        retryTimersRef.current.push(id);
      });
    };

    // Listen for download progress + completion.
    (async () => {
      listenerRef.current = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
        console.log('[AppUpdate] state change:', JSON.stringify(state));
        if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADING) {
          setDownloading(true);
          const total = (state as any).bytesToDownload || 0;
          const got = (state as any).bytesDownloaded || 0;
          setDownloadProgress(total > 0 ? Math.round((got / total) * 100) : null);
        } else if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
          setDownloading(false);
          setDownloaded(true);
        } else if (state.installStatus === FlexibleUpdateInstallStatus.FAILED) {
          setDownloading(false);
        }
      });
    })();

    // Initial round of checks on launch.
    runChecks();

    // Re-run checks every time the app returns to the foreground.
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
      listenerRef.current?.remove().catch(() => {});
      appStateListenerRef.current?.remove().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startUpdate = async () => {
    try {
      await AppUpdate.startFlexibleUpdate();
    } catch (err) {
      console.error('startFlexibleUpdate failed:', err);
    }
  };

  const completeUpdate = async () => {
    try {
      await AppUpdate.completeFlexibleUpdate();
    } catch (err) {
      console.error('completeFlexibleUpdate failed:', err);
    }
  };

  if (downloaded) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCw className="h-5 w-5 text-primary" /> Update ready</DialogTitle>
            <DialogDescription>
              The new version of Nourish has been downloaded. Restart to finish installing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={completeUpdate} className="w-full">Restart now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (updateAvailable) {
    return (
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o && !downloading) {
            dismissedRef.current = true;
            setUpdateAvailable(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Update available</DialogTitle>
            <DialogDescription>
              A new version of Nourish is ready to download. You can keep using the app while it downloads in the background.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => { dismissedRef.current = true; setUpdateAvailable(false); }}
            >
              Later
            </Button>
            <Button onClick={startUpdate} disabled={downloading}>
              {downloading
                ? (downloadProgress !== null ? `Downloading ${downloadProgress}%` : 'Downloading…')
                : 'Update now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
