'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ShieldCheck, Leaf } from 'lucide-react';

function AdminSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyAdmin = useAction(api.admin.verifyAdmin);
  const verifyTotpCode = useAction(api.adminTotp.verifyCode);

  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  const totpStatus = useQuery(
    api.adminTotpDb.getStatus,
    verifiedEmail ? { adminEmail: verifiedEmail } : 'skip'
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token) router.push('/admin');
    }
  }, [router]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  useEffect(() => {
    if (step === 'totp') setTimeout(() => totpRef.current?.focus(), 100);
  }, [step]);

  useEffect(() => {
    if (!verifiedEmail || totpStatus === undefined) return;
    if (totpStatus.enabled) {
      setStep('totp');
      setIsLoading(false);
    } else {
      fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: verifiedEmail }),
      }).then(() => {
        localStorage.setItem('admin_token', verifiedEmail);
        router.push('/admin');
      });
    }
  }, [verifiedEmail, totpStatus, router]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await verifyAdmin({ email, password });
      if (!result.success) {
        setError((result as any).locked
          ? 'Too many failed attempts. Please wait 15 minutes and try again.'
          : 'Invalid admin credentials. Please try again.');
        setIsLoading(false);
        return;
      }
      setVerifiedEmail(result.email!);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.replace(/\s/g, '').length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const result = await verifyTotpCode({ adminEmail: verifiedEmail, code: totpCode });
      if (!result.valid) {
        setError('Invalid or expired code. Please try again.');
        setTotpCode('');
        setIsLoading(false);
        return;
      }
      await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: verifiedEmail }),
      });
      localStorage.setItem('admin_token', verifiedEmail);
      router.push('/admin');
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (step === 'totp') {
    return (
      <form onSubmit={handleTotp} className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Open your authenticator app and enter the 6-digit code for <strong>Nourish Admin</strong>.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Authenticator Code</label>
          <Input
            ref={totpRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            maxLength={7}
            placeholder="000000"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={isLoading}
            required
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
          />
        </div>
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          disabled={isLoading || totpCode.length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify & Sign In'}
        </Button>
        <button
          type="button"
          onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); setVerifiedEmail(''); setIsLoading(false); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          ← Back to credentials
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Admin Email</label>
        <Input
          type="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        disabled={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Continue →'}
      </Button>
    </form>
  );
}

export default function AdminSignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-start pt-12 p-4">
      <div className="w-full max-w-md space-y-8 mx-auto">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Leaf className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
            Nourish Admin
          </h1>
        </div>

        <Card className="shadow-xl border-2">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Admin Sign In</CardTitle>
            <CardDescription>Enter your admin credentials to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-lg text-sm flex items-center justify-center gap-2 text-center">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Admin access only. Unauthorized access attempts may be logged.</span>
            </div>
            <Suspense fallback={<div className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />}>
              <AdminSignInForm />
            </Suspense>
          </CardContent>
        </Card>

        <div className="text-center">
          <a href="/" className="text-sm text-green-500 hover:underline font-medium">← Back to App</a>
        </div>
      </div>
    </div>
  );
}
