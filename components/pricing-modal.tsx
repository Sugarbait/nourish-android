'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Star, Crown, Sparkles, RefreshCcw } from 'lucide-react';
import { CREDIT_PACKAGES, CreditPackage, CreditData } from '@/lib/credits';
import { useToast } from '@/hooks/use-toast';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditData;
  onCreditsUpdate: (data: CreditData) => void;
  isGuest?: boolean;
  onRequestSignIn?: () => void;
  userId?: string | null;
  userEmail?: string | null;
}

const PACK_ICONS: Record<CreditPackage, React.ReactNode> = {
  starter: <Zap className="h-6 w-6" />,
  value:   <Star className="h-6 w-6" />,
  pro:     <Crown className="h-6 w-6" />,
};

const PACK_COLORS: Record<CreditPackage, string> = {
  starter: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  value:   'from-violet-500/20 to-violet-600/10 border-violet-500/30',
  pro:     'from-amber-500/20 to-amber-600/10 border-amber-500/30',
};

const PACK_ICON_COLORS: Record<CreditPackage, string> = {
  starter: 'text-blue-400 bg-blue-500/10',
  value:   'text-violet-400 bg-violet-500/10',
  pro:     'text-amber-400 bg-amber-500/10',
};

export function PricingModal({ open, onOpenChange, credits, onCreditsUpdate, isGuest, onRequestSignIn, userId, userEmail }: PricingModalProps) {
  const { toast } = useToast();
  const createCheckoutSession = useAction(api.stripeActions.createCheckoutSession);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const checkout = async (priceKey: string) => {
    try {
      const result = await createCheckoutSession({
        priceKey,
        successUrl: `${window.location.origin}/?checkout=success`,
        cancelUrl:  `${window.location.origin}/`,
        ...(userId        ? { userId }                    : {}),
        ...(userEmail     ? { customerEmail: userEmail }  : {}),
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast({ title: 'Checkout failed', description: result.error || 'Could not open Stripe. Please try again.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Checkout failed', description: err.message || 'Something went wrong.', variant: 'destructive' });
    }
  };

  const handleBuyPack = async (pkg: CreditPackage) => {
    if (isGuest) {
      toast({ title: 'Sign in required', description: 'Please sign in to purchase credits.' });
      onOpenChange(false);
      setTimeout(() => onRequestSignIn?.(), 400);
      return;
    }
    if (!credits.subscription?.active) {
      toast({ title: 'Subscription required', description: 'You must be a subscriber to purchase credit top-ups.', variant: 'destructive' });
      return;
    }
    await checkout(pkg);
  };

  const handleSubscribe = async () => {
    if (isGuest) {
      toast({ title: 'Sign in required', description: 'Please sign in to subscribe.' });
      onOpenChange(false);
      setTimeout(() => onRequestSignIn?.(), 400);
      return;
    }
    if (credits.subscription?.active) {
      toast({ title: 'Already subscribed', description: 'Your plan is already active.' });
      return;
    }
    await checkout(billingCycle === 'yearly' ? 'subscription_yearly' : 'subscription');
  };

  const isSubscribed = credits.subscription?.active === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl font-bold">Get More Credits</DialogTitle>
          </div>
          <DialogDescription>
            Top up your credits to keep scanning meals and chatting with your AI coach.
          </DialogDescription>
        </DialogHeader>

        {/* Guest notice */}
        {isGuest && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-2">
            <div className="text-2xl leading-none">🔒</div>
            <div>
              <p className="font-semibold text-sm">Sign in required</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You need an account to subscribe or purchase credits.{' '}
                <button onClick={() => { onOpenChange(false); setTimeout(() => onRequestSignIn?.(), 400); }} className="text-primary underline underline-offset-2">Sign in or sign up</button>
              </p>
            </div>
          </div>
        )}

        {/* Free tier reminder */}
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 mb-2">
          <div className="text-2xl leading-none">🎁</div>
          <div>
            <p className="font-semibold text-sm">Free Daily Scan (always included)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every day you get <strong>1 free meal scan</strong> — no purchase needed. Resets at midnight. AI coach is available to subscribers.
            </p>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/50 w-fit mx-auto">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Yearly
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Save 25%</span>
          </button>
        </div>

        {/* Subscription card */}
        <div className={`relative rounded-xl border-2 p-5 bg-gradient-to-br ${isSubscribed ? 'from-green-500/10 to-green-600/5 border-green-500/50' : 'from-primary/10 to-primary/5 border-primary/40'}`}>
          {!isSubscribed && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5">
              {billingCycle === 'yearly' ? 'Best Value' : 'Recommended'}
            </Badge>
          )}
          {isSubscribed && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-0.5">
              Active Plan
            </Badge>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-primary" />
                {billingCycle === 'yearly' ? 'Yearly Pro' : 'Monthly Pro'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                300 credits per month — use them for meal scans or AI coaching. Credits <strong>roll over</strong> — never lose unused credits.
              </p>
              <ul className="mt-3 space-y-1.5">
                {[
                  '300 credits/mo for scans & AI coaching',
                  'Use credits however you need them',
                  'Credits roll over month to month',
                  'Priority support',
                  ...(billingCycle === 'yearly' ? ['2 months free vs monthly'] : []),
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0">
              {billingCycle === 'yearly' ? (
                <>
                  <div className="text-2xl font-bold">$35.99</div>
                  <div className="text-xs text-muted-foreground">/year</div>
                  <div className="text-xs text-emerald-400 mt-0.5">~$3.00/mo</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">$3.99</div>
                  <div className="text-xs text-muted-foreground">/month</div>
                </>
              )}
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={handleSubscribe}
                disabled={isSubscribed}
                variant={isSubscribed ? 'outline' : 'default'}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">Or buy a one-time credit pack</span>
          </div>
        </div>

        {!isGuest && !isSubscribed && (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>🔒</span>
            <span>Credit packs are available to subscribers. Subscribe to Monthly Pro first.</span>
          </div>
        )}

        {/* One-time packs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(CREDIT_PACKAGES) as CreditPackage[]).map((pkg) => {
            const pack = CREDIT_PACKAGES[pkg];
            return (
              <div
                key={pkg}
                className={`relative rounded-xl border bg-gradient-to-br p-4 flex flex-col gap-3 ${PACK_COLORS[pkg]}`}
              >
                {pack.badge && (
                  <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs px-2 py-0">
                    {pack.badge}
                  </Badge>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${PACK_ICON_COLORS[pkg]}`}>
                  {PACK_ICONS[pkg]}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{pack.label}</h4>
                  <p className="text-2xl font-bold mt-0.5">{pack.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">one-time</p>
                </div>
                <ul className="space-y-1 flex-1">
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    {pack.credits} credits
                  </li>
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    Scans &amp; AI coaching
                  </li>
                  <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    Never expires
                  </li>
                </ul>
                <Button size="sm" className="w-full" onClick={() => handleBuyPack(pkg)} disabled={!isGuest && !isSubscribed}>
                  {!isGuest && !isSubscribed ? 'Subscribers Only' : 'Buy Now'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Cost transparency note */}
        <p className="text-center text-xs text-muted-foreground mt-2 pb-1">
          Secure checkout via Stripe &bull; Instant delivery
        </p>
      </DialogContent>
    </Dialog>
  );
}
