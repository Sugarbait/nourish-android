'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Check, Zap, RefreshCcw } from 'lucide-react';
import { CreditData } from '@/lib/credits';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/hooks/use-toast';

interface NoCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'meal' | 'ai' | 'recipe';
  credits: CreditData;
  onCreditsUpdate: (data: CreditData) => void;
  /** Called when user wants to see full pricing / one-time packs */
  onShowPricing: () => void;
  /** Whether the user is a guest (not signed in) */
  isGuest?: boolean;
  /** Called when a guest clicks subscribe — should open sign-in modal */
  onRequestSignIn?: () => void;
  userId?: string | null;
  userEmail?: string | null;
}

const CONTENT = {
  meal: {
    emoji: '📸',
    headline: "You're out of meal scans!",
    sub: "Don't let today's nutrition go untracked. Upgrade to Nourish Pro and keep snapping — your health goals are worth it.",
    cta: 'Unlock Meal Scanning',
  },
  ai: {
    emoji: '🤖',
    headline: 'AI Coach is for subscribers',
    sub: "The AI nutritional coach is a subscriber-only feature. Subscribe to get personalised coaching, meal recommendations, and hydration tips every day.",
    cta: 'Unlock AI Coaching',
  },
  recipe: {
    emoji: '🥗',
    headline: 'AI Recipes are for subscribers',
    sub: "AI-powered recipe generation is a subscriber-only feature. Subscribe to get personalized, healthy recipe ideas based on your daily macros.",
    cta: 'Unlock AI Recipes',
  },
};

const PERKS = [
  '300 credits/mo — use for scans or AI coaching',
  'AI nutritional coach access included',
  'Credits roll over — never lose what you earn',
  'Cancel anytime, no hidden fees',
];

export function NoCreditsModal({
  open,
  onOpenChange,
  type,
  credits,
  onCreditsUpdate: _onCreditsUpdate,
  onShowPricing,
  isGuest,
  onRequestSignIn,
  userId,
  userEmail,
}: NoCreditsModalProps) {
  const { toast } = useToast();
  const createCheckoutSession = useAction(api.stripeActions.createCheckoutSession);
  // 'closed' | 'opening' | 'open' | 'closing'
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  useEffect(() => {
    if (open) {
      setPhase('opening');
      const t = setTimeout(() => setPhase('open'), 20); // allow CSS to register initial state
      return () => clearTimeout(t);
    } else {
      setPhase(prev => (prev === 'closed' ? 'closed' : 'closing'));
      const t = setTimeout(() => setPhase('closed'), 380);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSubscribe = async () => {
    if (isGuest) {
      close();
      setTimeout(() => onRequestSignIn?.(), 400);
      return;
    }
    if (credits.subscription?.active) {
      toast({ title: 'Already subscribed!', description: 'Your Monthly Pro plan is already active.' });
      close();
      return;
    }
    try {
      const result = await createCheckoutSession({
        priceKey: 'subscription',
        successUrl: `${window.location.origin}/?checkout=success`,
        cancelUrl:  `${window.location.origin}/`,
        ...(userId    ? { userId }                   : {}),
        ...(userEmail ? { customerEmail: userEmail } : {}),
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast({ title: 'Checkout failed', description: result.error || 'Could not open Stripe.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Checkout failed', description: err.message || 'Something went wrong.', variant: 'destructive' });
    }
  };

  const handleShowPricing = () => {
    close();
    setTimeout(() => onShowPricing(), 400);
  };

  if (phase === 'closed') return null;

  const content = CONTENT[type];
  const isOpen = phase === 'open' || phase === 'opening';

  return (
    <>
      <style>{`
        @keyframes nai-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nai-backdrop-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes nai-modal-in {
          from { opacity: 0; transform: translateY(32px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes nai-modal-out {
          from { opacity: 1; transform: translateY(0)    scale(1);    }
          to   { opacity: 0; transform: translateY(24px) scale(0.95); }
        }
        @keyframes nai-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes nai-pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.7; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        @keyframes nai-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes nai-sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50%       { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        .nai-backdrop {
          animation: nai-backdrop-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .nai-backdrop-out {
          animation: nai-backdrop-out 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .nai-modal {
          animation: nai-modal-in 0.38s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .nai-modal-out {
          animation: nai-modal-out 0.32s cubic-bezier(0.4,0,1,1) forwards;
        }
        .nai-float {
          animation: nai-float 3s ease-in-out infinite;
        }
        .nai-pulse-ring {
          animation: nai-pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite;
        }
        .nai-shimmer-btn {
          background: linear-gradient(
            90deg,
            hsl(var(--primary)) 0%,
            hsl(142 76% 60%) 40%,
            hsl(var(--primary)) 80%
          );
          background-size: 200% auto;
          animation: nai-shimmer 2.4s linear infinite;
        }
        .nai-sparkle-1 { animation: nai-sparkle 2.2s ease-in-out 0.0s infinite; }
        .nai-sparkle-2 { animation: nai-sparkle 2.2s ease-in-out 0.7s infinite; }
        .nai-sparkle-3 { animation: nai-sparkle 2.2s ease-in-out 1.4s infinite; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm ${isOpen ? 'nai-backdrop' : 'nai-backdrop-out'}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`relative w-full max-w-sm pointer-events-auto rounded-3xl border border-border/40 bg-card text-card-foreground shadow-2xl overflow-hidden ${isOpen ? 'nai-modal' : 'nai-modal-out'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade to continue"
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Decorative gradient top band */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-primary to-teal-400" />

          {/* Top glow bg blob */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center gap-5">
            {/* Floating emoji with pulse rings */}
            <div className="relative nai-float">
              {/* Outer pulse ring */}
              <div className="absolute inset-0 rounded-full bg-primary/20 nai-pulse-ring" style={{ animationDelay: '0s' }} />
              {/* Inner pulse ring */}
              <div className="absolute inset-0 rounded-full bg-primary/15 nai-pulse-ring" style={{ animationDelay: '0.4s' }} />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-4xl shadow-lg">
                {content.emoji}
              </div>
              {/* Sparkle dots */}
              <Sparkles className="nai-sparkle-1 absolute -top-2 -right-2 h-4 w-4 text-primary" />
              <Sparkles className="nai-sparkle-2 absolute -bottom-1 -left-3 h-3 w-3 text-emerald-400" />
              <Sparkles className="nai-sparkle-3 absolute top-1 -left-4 h-3.5 w-3.5 text-teal-300" />
            </div>

            {/* Headline */}
            <div>
              <h2 className="text-xl font-bold tracking-tight leading-snug">{content.headline}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{content.sub}</p>
            </div>

            {/* Price badge */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-foreground">$3.99</span>
              <div className="text-left">
                <div className="text-xs text-muted-foreground leading-none">per</div>
                <div className="text-xs text-muted-foreground leading-none">month</div>
              </div>
            </div>

            {/* Perks list */}
            <ul className="w-full space-y-2 text-left">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{perk}</span>
                </li>
              ))}
            </ul>

            {/* CTA button — shimmer animated */}
            <button
              onClick={handleSubscribe}
              className="nai-shimmer-btn w-full rounded-xl py-3.5 px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {isGuest ? 'Sign In to Subscribe' : `${content.cta} — $3.99/mo`}
            </button>

          </div>
        </div>
      </div>
    </>
  );
}
