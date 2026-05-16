// Centralized helpers for managing user-scoped localStorage keys.
// Every sign-in and sign-out path goes through these so a fresh device login
// (or user switch on a shared device) cannot see a previous account's data.

const IDENTITY_KEYS = [
  'nourish_user_id',
  'nourish_user_name',
  'nourish_user_avatar',
  'nourish_user_email',
] as const;

// User-scoped data — must be wiped whenever the active user changes so a
// signed-in user never reads another user's stale meals / goals / counters.
const USER_DATA_KEYS = [
  'nourishai-credits',
  'nourishai-data',          // meal + water history (APP_STORAGE_KEY)
  'nourishai-profile',       // local profile + goals (PROFILE_STORAGE_KEY)
  'nourish-notifications-sent', // notification celebration set
] as const;

function clearUserDataStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of USER_DATA_KEYS) {
    try { localStorage.removeItem(key); } catch {}
  }
}

/**
 * Persist auth identity on sign-in. If the userId differs from whatever was
 * previously cached, all user-scoped data is wiped so Convex becomes the only
 * source of truth on this device.
 */
export function saveAuthToStorage(
  userId: string,
  name: string | null | undefined,
  avatarUrl: string | null | undefined,
  email?: string | null,
): void {
  if (typeof window === 'undefined') return;
  const previousUserId = localStorage.getItem('nourish_user_id');
  if (previousUserId !== userId) clearUserDataStorage();

  localStorage.setItem('nourish_user_id', userId);
  if (name)      localStorage.setItem('nourish_user_name', name);   else localStorage.removeItem('nourish_user_name');
  if (avatarUrl) localStorage.setItem('nourish_user_avatar', avatarUrl); else localStorage.removeItem('nourish_user_avatar');
  if (email)     localStorage.setItem('nourish_user_email', email); else localStorage.removeItem('nourish_user_email');
}

/** Wipe identity + all user-scoped data. Used by sign-out. */
export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of IDENTITY_KEYS) {
    try { localStorage.removeItem(key); } catch {}
  }
  clearUserDataStorage();
}
