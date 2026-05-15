import { internalQuery } from "./_generated/server";

export const _getAllEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ email: u.email }));
  },
});
