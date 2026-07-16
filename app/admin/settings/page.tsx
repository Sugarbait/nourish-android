'use client';

import { useState, useEffect } from 'react';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldCheck, ShieldOff, ShieldAlert, LogOut, ArrowLeft,
  Copy, Check, RefreshCw, AlertCircle, KeyRound,
} from 'lucide-react';
import { goTo } from '@/lib/staticNav';

type SetupState = 'idle' | 'pending' | 'done';

export default function AdminSettingsPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      goTo('/admin/signin');
    } else {
      setSessionToken(token);
    }
  }, []);

  const totpStatus = useQuery(
    api.adminTotpDb.getStatus,
    sessionToken ? { sessionToken } : 'skip'
  );

  // getStatus returns null when the session is no longer valid — bounce to sign-in.
  useEffect(() => {
    if (totpStatus === null) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_email');
      goTo('/admin/signin');
    }
  }, [totpStatus]);
  const generateSetupData = useAction(api.adminTotp.generateSetupData);
  const verifyAndEnable = useAction(api.adminTotp.verifyAndEnable);
  const disableTotp = useAction(api.adminTotp.disable);
  const deleteSession = useMutation(api.adminSession.deleteSession);

  const [setupState, setSetupState] = useState<SetupState>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);

  const adminEmail = typeof window !== 'undefined' ? localStorage.getItem('admin_email') ?? 'admin' : 'admin';

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleStartSetup = async () => {
    setError('');
    setSuccessMsg('');
    setIsWorking(true);
    try {
      const data = await generateSetupData({ sessionToken: sessionToken! });
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setSetupState('pending');
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate setup data.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    setIsWorking(true);
    try {
      const result = await verifyAndEnable({ sessionToken: sessionToken!, code: verifyCode });
      if (!result.success) {
        setError(result.error ?? 'Verification failed.');
        setVerifyCode('');
      } else {
        setSetupState('done');
        setSuccessMsg('Two-factor authentication is now enabled!');
        setVerifyCode('');
      }
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableCode.length !== 6) { setError('Enter the 6-digit code to confirm disabling 2FA.'); return; }
    setError('');
    setIsWorking(true);
    try {
      const result = await disableTotp({ sessionToken: sessionToken!, code: disableCode });
      if (!result.success) {
        setError(result.error ?? 'Failed to disable TOTP.');
        setDisableCode('');
      } else {
        setSuccessMsg('Two-factor authentication has been disabled.');
        setShowDisableForm(false);
        setDisableCode('');
        setSetupState('idle');
      }
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error.');
    } finally {
      setIsWorking(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') ?? secret;
  const isEnabled = totpStatus?.enabled ?? false;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-10 p-4 md:p-8">
      <div className="w-full max-w-md space-y-6">

        {/* Back button row */}
        <div className="flex items-center justify-between">
          <Button onClick={() => goTo('/admin')} variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Button>
          <Button
            onClick={async () => {
              if (sessionToken) await deleteSession({ sessionToken }).catch(() => {});
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_email');
              goTo('/');
            }}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>

        {/* Centered page title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Signed in as <span className="font-medium text-foreground">{adminEmail}</span>
          </p>
        </div>

        {error && (
          <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-green-700 dark:text-green-300 text-sm font-medium">{successMsg}</p>
          </div>
        )}

        <Card className="border-2 shadow-xl">
          <CardHeader className="items-center text-center pb-2">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center mb-2 ${
              isEnabled
                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
            }`}>
              {isEnabled ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>
            <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-center">
              {isEnabled ? 'Your admin account is protected with TOTP.' : 'Add an extra layer of security to your admin account.'}
            </CardDescription>
            <span className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
              isEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            }`}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </CardHeader>

          <CardContent className="space-y-6">

            {!isEnabled && setupState === 'idle' && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Use any TOTP app such as <strong>Google Authenticator</strong>, <strong>Authy</strong>,
                  or <strong>1Password</strong> to scan the QR code and generate time-based codes on each sign-in.
                </p>
                <Button onClick={handleStartSetup} disabled={isWorking} className="gap-2 bg-green-600 hover:bg-green-700 w-full">
                  <KeyRound className="w-4 h-4" />
                  {isWorking ? 'Generating...' : 'Set Up Two-Factor Authentication'}
                </Button>
              </div>
            )}

            {!isEnabled && setupState === 'pending' && (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h3 className="font-semibold">Step 1 — Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Open your authenticator app and scan the QR code below. If you can&apos;t scan, enter the setup key manually.
                  </p>
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl border shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="TOTP QR Code" width={180} height={180} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Or enter this setup key manually:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm bg-secondary/50 px-3 py-2 rounded-md tracking-widest break-all text-left">
                        {formattedSecret}
                      </code>
                      <Button type="button" variant="outline" size="icon" onClick={copySecret} title="Copy key" className="flex-shrink-0">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Account: <strong>{adminEmail}</strong><br />
                      Issuer: <strong>Nourish Admin</strong><br />
                      Type: <strong>Time-based (TOTP)</strong>
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold text-center">Step 2 — Verify Code</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Enter the 6-digit code from your authenticator app to confirm setup.
                  </p>
                  <form onSubmit={handleVerifyAndEnable} className="flex flex-col items-center gap-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      disabled={isWorking}
                      className="w-40 text-center font-mono text-2xl tracking-[0.5em]"
                      autoComplete="one-time-code"
                    />
                    <div className="flex gap-2 w-full">
                      <Button type="submit" disabled={isWorking || verifyCode.length !== 6} className="flex-1 bg-green-600 hover:bg-green-700">
                        {isWorking ? 'Verifying...' : 'Enable 2FA'}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={handleStartSetup} disabled={isWorking} title="Regenerate QR">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {setupState === 'done' && (
              <div className="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg text-center">
                <ShieldCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200 text-sm">2FA is now active</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Your next sign-in will require a code from your authenticator app.</p>
                </div>
              </div>
            )}

            {isEnabled && setupState !== 'done' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg text-center">
                  <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200 text-sm">2FA is active on your account</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Every sign-in requires a valid code from your authenticator app.</p>
                  </div>
                </div>
                {!showDisableForm ? (
                  <Button
                    variant="outline"
                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 w-full"
                    onClick={() => { setShowDisableForm(true); setError(''); }}
                  >
                    <ShieldOff className="w-4 h-4" /> Disable Two-Factor Authentication
                  </Button>
                ) : (
                  <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 space-y-3 bg-red-50/50 dark:bg-red-950/30 text-center">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Enter your current authenticator code to confirm disabling 2FA.
                    </p>
                    <form onSubmit={handleDisable} className="flex flex-col items-center gap-3">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                        disabled={isWorking}
                        className="w-40 text-center font-mono text-2xl tracking-[0.5em]"
                        autoComplete="one-time-code"
                      />
                      <div className="flex gap-2 w-full">
                        <Button type="button" variant="ghost" className="flex-1" onClick={() => { setShowDisableForm(false); setError(''); setDisableCode(''); }}>
                          Cancel
                        </Button>
                        <Button type="submit" variant="destructive" className="flex-1" disabled={isWorking || disableCode.length !== 6}>
                          {isWorking ? 'Disabling...' : 'Confirm Disable'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <a href="/admin/index.html" onClick={(e) => { e.preventDefault(); goTo('/admin'); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
