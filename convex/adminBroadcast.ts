import { internalQuery } from "./_generated/server";

export const _getAllEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const prefsByUser = new Map(profiles.map((p) => [p.userId as unknown as string, p.notificationPreferences]));

    return users
      .filter((u) => {
        // Skip users who have explicitly opted out. Treat missing/undefined as opt-in
        // for backwards compatibility (pre-existing accounts without the field).
        const prefs = prefsByUser.get(u._id as unknown as string);
        return prefs?.broadcastEmails !== false;
      })
      .map((u) => ({ email: u.email }));
  },
});
