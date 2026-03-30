'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Sparkles, UserPlus, Zap } from 'lucide-react';

interface GuestUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'scan' | 'coach';
  onSignUp: () => void;
  onShowPricing: () => void;
}

const CONTENT = {
  scan: {
    emoji: '📸',
    headline: "You've used your free scan for today!",
    sub: 'Create a free account to get your daily scan every day, track your progress over time, and unlock more with a subscription.',
  },
  coach: {
    emoji: '🤖',
    headline: 'AI Coach is for members only',
    sub: 'Sign up for free and get access to your personal AI nutritional coach, daily meal tracking, and more.',
  },
};

const PERKS = [
  '1 free meal scan every day',
  'Track your nutrition history',
  'Set and monitor personal goals',
  'Unlock AI Coach with a subscription',
];

export function GuestUpsellModal({
  open,
  onOpenChange,
  type,
  onSignUp,
  onShowPricing,
}: GuestUpsellModalProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  useEffect(() => {
    if (open && phase === 'closed') {
      setPhase('opening');
      const t = setTimeout(() => setPhase('open'), 20);
      return () => clearTimeout(t);
    }
    if (!open && (phase === 'open' || phase === 'opening')) {
      setPhase('closing');
      const t = setTimeout(() => setPhase('closed'), 380);
      return () => clearTimeout(t);
    }
  }, [open, phase]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSignUp = () => {
    close();
    setTimeout(() => onSignUp(), 400);
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
        @keyframes gu-backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gu-backdrop-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes gu-modal-in  { from { opacity: 0; transform: translateY(32px) scale(0.93) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes gu-modal-out { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(24px) scale(0.95) } }
        @keyframes gu-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes gu-pulse-ring { 0% { transform: scale(0.95); opacity: 0.7 } 70% { transform: scale(1.25); opacity: 0 } 100% { transform: scale(0.95); opacity: 0 } }
        @keyframes gu-shimmer { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        .gu-backdrop  { animation: gu-backdrop-in  0.3s cubic-bezier(0.16,1,0.3,1) forwards }
        .gu-backdrop-out { animation: gu-backdrop-out 0.35s cubic-bezier(0.16,1,0.3,1) forwards }
        .gu-modal     { animation: gu-modal-in  0.38s cubic-bezier(0.16,1,0.3,1) forwards }
        .gu-modal-out { animation: gu-modal-out 0.32s cubic-bezier(0.4,0,1,1) forwards }
        .gu-float     { animation: gu-float 3s ease-in-out infinite }
        .gu-pulse-ring { animation: gu-pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite }
        .gu-shimmer-btn {
          background: linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(142 76% 60%) 40%, hsl(var(--primary)) 80%);
          background-size: 200% auto;
          animation: gu-shimmer 2.4s linear infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm ${isOpen ? 'gu-backdrop' : 'gu-backdrop-out'}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`relative w-full max-w-sm pointer-events-auto rounded-3xl border border-border/40 bg-card text-card-foreground shadow-2xl overflow-hidden ${isOpen ? 'gu-modal' : 'gu-modal-out'}`}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Top gradient bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-primary to-teal-400" />

          {/* Top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center gap-5">
            {/* Floating emoji */}
            <div className="relative gu-float">
              <div className="absolute inset-0 rounded-full bg-primary/20 gu-pulse-ring" style={{ animationDelay: '0s' }} />
              <div className="absolute inset-0 rounded-full bg-primary/15 gu-pulse-ring" style={{ animationDelay: '0.4s' }} />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-4xl shadow-lg">
                {content.emoji}
              </div>
              <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-primary opacity-80" />
              <Sparkles className="absolute -bottom-1 -left-3 h-3 w-3 text-emerald-400 opacity-80" />
            </div>

            {/* Text */}
            <div>
              <h2 className="text-xl font-bold tracking-tight leading-snug">{content.headline}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{content.sub}</p>
            </div>

            {/* Perks */}
            <ul className="w-full space-y-2 text-left">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-primary font-bold">✓</span>
                  </div>
                  <span className="text-muted-foreground">{perk}</span>
                </li>
              ))}
            </ul>

            {/* Primary CTA */}
            <button
              onClick={handleSignUp}
              className="gu-shimmer-btn w-full rounded-xl py-3.5 px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create Free Account
            </button>

            {/* Secondary CTA */}
            <button
              onClick={handleShowPricing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Zap className="h-3 w-3" />
              Already have an account? Sign in or subscribe →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
