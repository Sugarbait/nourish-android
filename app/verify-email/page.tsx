'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const verifyEmailToken = useAction(api.verifyEmail.verifyEmailToken);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setErrorMessage('Invalid verification link. Please check your email and try again.');
      setStatus('error');
      return;
    }

    let cancelled = false;

    verifyEmailToken({ token, email })
      .then((result) => {
        if (cancelled) return;
        // Save auth to localStorage
        localStorage.setItem('nourish_user_id', result.userId);
        if (result.name) localStorage.setItem('nourish_user_name', result.name);
        else localStorage.removeItem('nourish_user_name');
        if (result.avatarUrl) localStorage.setItem('nourish_user_avatar', result.avatarUrl);
        else localStorage.removeItem('nourish_user_avatar');
        localStorage.setItem('nourish_user_email', email);

        setStatus('success');
        // Redirect to dashboard after brief success message
        setTimeout(() => {
          window.location.href = '/dashboard/';
        }, 1800);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg = err?.message ?? 'Something went wrong. Please try again.';
        setErrorMessage(msg);
        setStatus('error');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-primary to-teal-400" />

          <div className="px-8 py-10 text-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <Image src="/logo.png" alt="Nourish" width={140} height={40} priority />
            </div>

            {status === 'loading' && (
              <>
                <div className="flex justify-center mb-5">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
                <h1 className="text-xl font-bold mb-2">Verifying your email…</h1>
                <p className="text-sm text-muted-foreground">Just a moment while we confirm your account.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center mb-5">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-xl font-bold mb-2">Email verified!</h1>
                <p className="text-sm text-muted-foreground mb-1">Your account is now active.</p>
                <p className="text-xs text-muted-foreground/60">Redirecting you to your dashboard…</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center mb-5">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="text-xl font-bold mb-2">Verification failed</h1>
                <p className="text-sm text-muted-foreground mb-6">{errorMessage}</p>
                <Button
                  onClick={() => { window.location.href = '/'; }}
                  className="w-full h-10 font-semibold bg-primary hover:bg-primary/90"
                >
                  Back to Sign In
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-5">
          &copy; {new Date().getFullYear()} Nourish
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
