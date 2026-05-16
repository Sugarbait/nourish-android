import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const updateNotificationPreferences = mutation({
  args: {
    userId: v.id('users'),
    mealReminders: v.boolean(),
    goalNudges: v.boolean(),
    creditResetAlert: v.boolean(),
    coachInsights: v.boolean(),
    broadcastEmails: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, mealReminders, goalNudges, creditResetAlert, coachInsights, broadcastEmails } = args;

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first();

    if (!profile) {
      return { success: false };
    }

    await ctx.db.patch(profile._id, {
      notificationPreferences: {
        mealReminders,
        goalNudges,
        creditResetAlert,
        coachInsights,
        broadcastEmails,
      },
    });

    return { success: true };
  },
});
