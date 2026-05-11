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

export default crons;
