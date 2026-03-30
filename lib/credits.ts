// Credit system for Nourish
// Single unified credit pool — 1 credit = 1 meal scan or 1 AI coach message (subscribers)

export const CREDITS_STORAGE_KEY = 'nourishai-credits';

// ---------------------------------------------------------------------------
// Cookie helpers — second layer alongside localStorage so clearing one store
// alone cannot reset the free daily scan counter.
// ---------------------------------------------------------------------------
const FREE_MEAL_COOKIE = 'nrsh_fm'; // value = YYYY-MM-DD when used

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + 2);
    document.cookie =
      `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  } catch { /* ignore */ }
}

export type SubscriptionPlan = 'monthly' | null;

export interface CreditData {
  // Unified credit pool (meal scans + AI coach messages draw from the same pool)
  credits: number;

  // Daily free scan tracking (reset each calendar day)
  lastFreeDate: string;       // YYYY-MM-DD
  dailyFreeMealUsed: boolean;
  dailyFreeAIUsed: boolean;   // kept for data compatibility

  // Subscription state (UI-only in this static build)
  subscription: {
    active: boolean;
    plan: SubscriptionPlan;
    expiresAt: string | null;
  } | null;
}

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// TESTING MODE: infinite credits
const TESTING = true;

export const defaultCreditData = (): CreditData => ({
  credits: TESTING ? 9999 : 0,
  lastFreeDate: '',
  dailyFreeMealUsed: false,
  dailyFreeAIUsed: false,
  subscription: TESTING ? { active: true, plan: 'monthly', expiresAt: null } : null,
});

export function loadCredits(): CreditData {
  if (typeof window === 'undefined') return defaultCreditData();
  try {
    const today = todayKey();
    const raw = localStorage.getItem(CREDITS_STORAGE_KEY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = raw ? JSON.parse(raw) : null;

    let data: CreditData;
    if (!parsed) {
      data = defaultCreditData();
    } else if ('mealCredits' in parsed || 'aiCredits' in parsed) {
      // Migrate from old split-pool format
      data = {
        credits: (parsed.mealCredits ?? 0) + (parsed.aiCredits ?? 0),
        lastFreeDate: parsed.lastFreeDate ?? '',
        dailyFreeMealUsed: parsed.dailyFreeMealUsed ?? false,
        dailyFreeAIUsed: parsed.dailyFreeAIUsed ?? false,
        subscription: parsed.subscription ?? null,
      };
    } else {
      data = parsed as CreditData;
    }

    // Always ensure credits is a valid number (never NaN/undefined)
    data.credits = Number(data.credits) || 0;

    // Reset daily free scan on a new day
    if (data.lastFreeDate !== today) {
      data.lastFreeDate = today;
      data.dailyFreeMealUsed = false;
      data.dailyFreeAIUsed = false;
    }

    // Cross-check with cookie — prevents a simple localStorage clear from
    // bypassing the daily limit.
    const cookieDate = getCookie(FREE_MEAL_COOKIE);
    if (cookieDate === today) {
      data.dailyFreeMealUsed = true;
      data.lastFreeDate = today;
    }

    return data;
  } catch {
    return defaultCreditData();
  }
}

export function saveCredits(data: CreditData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Credits available for meal scans (free daily scan + paid pool) */
export function availableMealCredits(data: CreditData): number {
  const freeRemaining = data.dailyFreeMealUsed ? 0 : 1;
  return freeRemaining + (Number(data.credits) || 0);
}

/** Credits available for AI coach (subscribers only — paid pool) */
export function availableAICredits(data: CreditData): number {
  return Number(data.credits) || 0;
}

/**
 * Try to consume 1 meal credit.
 * Returns updated CreditData on success, or null if no credits available.
 * Also writes a cookie so clearing localStorage alone cannot bypass the daily limit.
 */
export function consumeMealCredit(data: CreditData): CreditData | null {
  if (TESTING) return data;
  if (!data.dailyFreeMealUsed) {
    const today = todayKey();
    setCookie(FREE_MEAL_COOKIE, today);
    return { ...data, dailyFreeMealUsed: true, lastFreeDate: today };
  }
  const pool = Number(data.credits) || 0;
  if (pool > 0) {
    return { ...data, credits: pool - 1 };
  }
  return null;
}

/**
 * Try to consume 1 AI credit (subscribers only).
 * Returns updated CreditData on success, or null if no credits available.
 */
export function consumeAICredit(data: CreditData): CreditData | null {
  if (TESTING) return data;
  const pool = Number(data.credits) || 0;
  if (pool > 0) {
    return { ...data, credits: pool - 1 };
  }
  return null;
}

/**
 * One-time credit packs.
 * Credits are a unified pool usable for meal scans or AI messages.
 */
export type CreditPackage = 'starter' | 'value' | 'pro';

export const CREDIT_PACKAGES: Record<
  CreditPackage,
  { label: string; price: string; credits: number; badge?: string }
> = {
  starter: { label: 'Starter', price: '$1.99', credits: 100, badge: 'Popular' },
  value:   { label: 'Value',   price: '$4.99', credits: 300 },
  pro:     { label: 'Pro',     price: '$9.99', credits: 800, badge: 'Best Value' },
};

export function addCreditPackage(data: CreditData, pkg: CreditPackage): CreditData {
  const { credits } = CREDIT_PACKAGES[pkg];
  return { ...data, credits: (Number(data.credits) || 0) + credits };
}

/**
 * Activate a monthly subscription ($3.99/mo).
 * Adds 40 credits to the unified pool (rollover) and sets expiry 30 days from now.
 */
export function activateSubscription(data: CreditData): CreditData {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return {
    ...data,
    credits: (Number(data.credits) || 0) + 40,
    subscription: {
      active: true,
      plan: 'monthly',
      expiresAt: expiry.toISOString(),
    },
  };
}
