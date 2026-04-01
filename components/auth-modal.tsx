'use client';

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Leaf, Eye, EyeOff, Loader2, X, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Brand SVG icons
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M11.4 24H0V12.6h11.4V24z" fill="#F1511B"/>
    <path d="M24 24H12.6V12.6H24V24z" fill="#80CC28"/>
    <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#00ADEF"/>
    <path d="M24 11.4H12.6V0H24v11.4z" fill="#FBBC09"/>
  </svg>
);

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'signin' | 'signup';
}

function getFriendlyError(err: any, context: 'signIn' | 'signUp' | 'reset' | 'resetVerify'): string {
  const raw = (err?.message ?? '').toLowerCase();

  if (context === 'signIn') {
    if (raw.includes('invalid') || raw.includes('wrong') || raw.includes('incorrect') || raw.includes('password') || raw.includes('credentials') || raw.includes('unauthorized') || raw.includes('not found') || raw.includes('no user'))
      return 'The email or password you entered is incorrect. Please try again.';
  }

  if (context === 'signUp') {
    if (raw.includes('already') || raw.includes('exists') || raw.includes('duplicate') || raw.includes('taken'))
      return 'An account with this email already exists. Try signing in instead.';
    if (raw.includes('password') || raw.includes('weak'))
      return 'Please choose a stronger password (at least 8 characters).';
  }

  if (context === 'reset') {
    if (raw.includes('not found') || raw.includes('no user') || raw.includes('invalid'))
      return "We couldn't find an account with that email address.";
  }

  if (context === 'resetVerify') {
    if (raw.includes('invalid') || raw.includes('expired') || raw.includes('code') || raw.includes('token'))
      return 'That code is incorrect or has expired. Please request a new one.';
  }

  return 'Something went wrong. Please try again in a moment.';
}

function saveAuthToStorage(userId: string, name: string | null, avatarUrl: string | null, email?: string) {
  localStorage.setItem('nourish_user_id', userId);
  if (name) localStorage.setItem('nourish_user_name', name);
  else localStorage.removeItem('nourish_user_name');
  if (avatarUrl) localStorage.setItem('nourish_user_avatar', avatarUrl);
  else localStorage.removeItem('nourish_user_avatar');
  if (email) localStorage.setItem('nourish_user_email', email);
  else localStorage.removeItem('nourish_user_email');
}

export function AuthModal({ open, onOpenChange, defaultTab = 'signin' }: AuthModalProps) {
  const { toast } = useToast();

  const loginUser = useAction(api.auth.loginUser);
  const createAccount = useAction(api.auth.createAccount);
  const createOrUpdateOAuthUser = useAction(api.auth.createOrUpdateOAuthUser);
  const requestPasswordReset = useAction(api.auth.requestPasswordReset);
  const resetPassword = useAction(api.auth.resetPassword);

  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resetView, setResetView] = useState<'request' | 'verify' | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const passwordsMatch = tab === 'signup' ? confirmPassword === '' || password === confirmPassword : true;
  const confirmTouched = confirmPassword.length > 0;
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');

  useEffect(() => {
    if (open) setPhase('open');
    else if (phase === 'open') {
      setPhase('closing');
      const t = setTimeout(() => setPhase('closed'), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setTab(defaultTab);
    setConfirmPassword('');
  }, [defaultTab]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch Google user info');
        const profile = await res.json();

        const result = await createOrUpdateOAuthUser({
          provider: 'google',
          providerId: profile.sub,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture || undefined,
        });
        saveAuthToStorage(result.userId as string, result.name, result.avatarUrl, profile.email);
        window.location.href = '/dashboard/';
      } catch (err: any) {
        toast({ title: 'Google sign-in failed', description: err.message || 'Something went wrong.', variant: 'destructive' });
        setLoading(false);
      }
    },
    onError: () => {
      toast({ title: 'Google sign-in failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    },
  });

  const handleMicrosoftSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '26865529-0a14-449e-8540-caddf613fa35';
    const redirectUri = window.location.origin + '/';
    const nonce = Math.random().toString(36).substring(7);
    sessionStorage.setItem('ms_oauth_nonce', nonce);
    // Request id_token + token so we can fetch the Graph API profile photo
    const msAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&response_type=id_token%20token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('openid profile email User.Read')}&nonce=${encodeURIComponent(nonce)}&response_mode=fragment`;
    window.location.href = msAuthUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'signup' && password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please make sure both passwords are identical.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (tab === 'signup') {
        await createAccount({ name, email, password });
        // Show "check your email" view — do NOT save to localStorage or redirect yet
        setPendingVerification(true);
      } else {
        const result = await loginUser({ email, password });
        saveAuthToStorage(result.userId as string, result.name, result.avatarUrl, email);
        toast({ title: 'Welcome back!', description: 'Signed in successfully.' });
        onOpenChange(false);
        window.location.href = '/dashboard/';
      }
    } catch (err: any) {
      toast({
        title: tab === 'signin' ? 'Sign in failed' : 'Sign up failed',
        description: getFriendlyError(err, tab === 'signin' ? 'signIn' : 'signUp'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setResetView('verify');
      toast({ title: 'Reset code ready', description: 'Enter the 6-digit code to set a new password.' });
    } catch (err: any) {
      toast({ title: 'Could not send reset code', description: getFriendlyError(err, 'reset'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword({ email, code: resetCode, newPassword });
      toast({ title: 'Password updated!', description: 'Please sign in with your new password.' });
      setResetView(null);
      setTab('signin');
      setPassword('');
    } catch (err: any) {
      toast({ title: 'Password reset failed', description: getFriendlyError(err, 'resetVerify'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'closed') return null;
  const isOpen = phase === 'open';

  return (
    <>
      <style>{`
        @keyframes auth-backdrop-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes auth-backdrop-out { from { opacity:1 } to { opacity:0 } }
        @keyframes auth-modal-in  { from { opacity:0; transform:translateY(24px) scale(.95) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes auth-modal-out { from { opacity:1; transform:translateY(0)    scale(1)   } to { opacity:0; transform:translateY(16px) scale(.97) } }
        .auth-bd-in  { animation: auth-backdrop-in  .25s ease forwards }
        .auth-bd-out { animation: auth-backdrop-out .3s  ease forwards }
        .auth-m-in   { animation: auth-modal-in  .32s cubic-bezier(.16,1,.3,1) forwards }
        .auth-m-out  { animation: auth-modal-out .28s ease forwards }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm ${isOpen ? 'auth-bd-in' : 'auth-bd-out'}`}
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={`pointer-events-auto w-full max-w-sm rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden ${isOpen ? 'auth-m-in' : 'auth-m-out'}`}>
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-primary to-teal-400" />

          {/* Close */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pt-6 pb-7">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Leaf className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-sm">Nourish</span>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-muted/50 p-1 mb-5">
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* Heading */}
            <div className="mb-5">
              <h2 className="text-lg font-bold">
                {tab === 'signin' ? 'Welcome back' : 'Start your journey'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tab === 'signin'
                  ? 'Sign in to access your meals and progress.'
                  : 'Create your free account — no credit card needed.'}
              </p>
            </div>

            {/* Email verification pending */}
            {pendingVerification && (
              <div className="text-center py-2">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h2 className="text-lg font-bold mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  We've sent a verification link to
                </p>
                <p className="text-sm font-semibold text-foreground mb-4 break-all">{email}</p>
                <p className="text-xs text-muted-foreground mb-6">
                  Click the link in your email to activate your account. The link expires in 24 hours.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => {
                    setPendingVerification(false);
                    setTab('signin');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setName('');
                  }}
                >
                  Back to Sign In
                </Button>
              </div>
            )}

            {/* Forgot password — request reset */}
            {!pendingVerification && resetView === 'request' && (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Reset your password</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter your email and we'll generate a reset code.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-xs">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-10 font-semibold">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : 'Send Reset Code'}
                </Button>
                <button type="button" onClick={() => setResetView(null)} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                  ← Back to sign in
                </button>
              </form>
            )}

            {/* Forgot password — verify code & set new password */}
            {!pendingVerification && resetView === 'verify' && (
              <form onSubmit={handleResetVerify} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Enter reset code</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter the 6-digit code to set a new password.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-code" className="text-xs">Reset Code</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="h-10 text-sm tracking-widest"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 text-sm pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-10 font-semibold">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</> : 'Set New Password'}
                </Button>
                <button type="button" onClick={() => setResetView('request')} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                  ← Resend code
                </button>
              </form>
            )}

            {/* Normal sign in / sign up flow */}
            {!pendingVerification && !resetView && <>

            {/* OAuth buttons */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => googleLogin()}
                className="w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all text-sm font-medium disabled:opacity-50"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleMicrosoftSignIn}
                className="w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all text-sm font-medium disabled:opacity-50"
              >
                <MicrosoftIcon /> Continue with Microsoft
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[11px] text-muted-foreground">or with email</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  {tab === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setResetView('request'); setResetCode(''); setNewPassword(''); }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={tab === 'signup' ? 'Min 8 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 text-sm pr-10"
                    required
                    minLength={tab === 'signup' ? 8 : 1}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`h-10 text-sm pr-10 transition-colors ${
                        confirmTouched && !passwordsMatch
                          ? 'border-destructive focus-visible:ring-destructive'
                          : confirmTouched && passwordsMatch
                          ? 'border-emerald-500 focus-visible:ring-emerald-500'
                          : ''
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmTouched && !passwordsMatch && (
                    <p className="text-[11px] text-destructive">Passwords do not match.</p>
                  )}
                  {confirmTouched && passwordsMatch && (
                    <p className="text-[11px] text-emerald-500">Passwords match.</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || (tab === 'signup' && confirmTouched && !passwordsMatch)}
                className="w-full h-10 mt-1 font-semibold bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Please wait…</>
                ) : tab === 'signin' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-4">
              {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
                className="text-primary hover:underline font-medium"
              >
                {tab === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>

            <p className="text-center text-[10px] text-muted-foreground/60 mt-3">
              By continuing you agree to our{' '}
              <a href="/terms" className="hover:underline">Terms</a>
              {' '}and{' '}
              <a href="/privacy" className="hover:underline">Privacy Policy</a>.
            </p>
            </>}
          </div>
        </div>
      </div>
    </>
  );
}
