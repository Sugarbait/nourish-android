# Credits System — LOCKED

**Status:** Locked as of v0.2.79 (2026-05-11)

**Locked files** — Changes only with explicit user permission:
- `convex/stripe.ts` — Subscription & pack credit mutations
- `convex/users.ts` — Credit consumption logic
- `convex/crons.ts` — Monthly refresh for yearly subscribers
- `convex/schema.ts` (credits/subscriptions tables)
- `lib/credits.ts` — Client-side credit logic
- `components/pricing-modal.tsx` — Pricing claims
- Stripe product descriptions (external)

**Current behavior (tested & working):**
- **Monthly subs:** 300 credits reset monthly
- **Yearly subs:** 300 credits reset monthly (via cron)
- **Pack credits:** Persist forever, never expire
- **Free daily scan:** 1 per day, resets at midnight
- **Consumption order:** Drain sub credits first, then pack credits

**Do not modify without explicit permission from user.**
