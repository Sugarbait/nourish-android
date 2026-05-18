import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh yearly subscribers' credits every 30 days.
// Runs daily so a user activated on the 15th refreshes on the 14th–15th the next month.
crons.daily(
  "refresh yearly subscriber credits",
  { hourUTC: 9, minuteUTC: 0 }, // 9:00 UTC daily
  internal.stripe.refreshYearlySubscribers,
);

// ---------------------------------------------------------------------------
// Data-retention jobs. Aim: store only what the app actually needs.
// All staggered slightly to avoid running in the same tick.
// ---------------------------------------------------------------------------
crons.daily(
  "prune old admin login attempts",
  { hourUTC: 3, minuteUTC: 0 },
  internal.retention.pruneOldAdminLoginAttempts,
);

crons.daily(
  "prune old AI chat messages",
  { hourUTC: 3, minuteUTC: 10 },
  internal.retention.pruneOldAiMessages,
);

crons.daily(
  "prune old contact messages",
  { hourUTC: 3, minuteUTC: 20 },
  internal.retention.pruneOldContactMessages,
);

crons.daily(
  "clear expired auth tokens",
  { hourUTC: 3, minuteUTC: 30 },
  internal.retention.pruneExpiredAuthTokens,
);

export default crons;
