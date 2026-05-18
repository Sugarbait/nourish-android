import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type MealReminderTimes = {
  breakfast: string;
  lunch: string;
  dinner: string;
};

export const DEFAULT_MEAL_TIMES: MealReminderTimes = {
  breakfast: '08:00',
  lunch: '12:00',
  dinner: '18:00',
};

const REMINDERS = [
  { id: 1001, key: 'breakfast' as const, title: 'Time for breakfast', body: 'Log your breakfast to stay on track.' },
  { id: 1002, key: 'lunch' as const,     title: 'Time for lunch',     body: 'Log your lunch to keep your streak going.' },
  { id: 1003, key: 'dinner' as const,    title: 'Time for dinner',    body: "Don't forget to log dinner today." },
];

function parseTime(hhmm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Cancel existing meal reminders and (if enabled) schedule fresh ones at the
 * provided times. Safe to call on web — no-ops outside a Capacitor native
 * runtime.
 */
export async function syncMealReminders(
  enabled: boolean,
  times: MealReminderTimes = DEFAULT_MEAL_TIMES,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: REMINDERS.map(({ id }) => ({ id })),
    });
  } catch {
    // ignore — cancelling non-existent ids is fine
  }

  if (!enabled) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') return;
  }

  const toSchedule = REMINDERS.map(({ id, key, title, body }) => {
    const parsed = parseTime(times[key]) ?? parseTime(DEFAULT_MEAL_TIMES[key])!;
    const next = new Date();
    next.setSeconds(0, 0);
    next.setHours(parsed.hour, parsed.minute, 0, 0);
    if (next.getTime() <= Date.now()) {
      next.setDate(next.getDate() + 1);
    }
    return {
      id,
      title,
      body,
      schedule: {
        at: next,
        repeats: true,
        every: 'day' as const,
        allowWhileIdle: true,
      },
      smallIcon: 'ic_launcher',
      largeIcon: 'ic_launcher',
    };
  });

  try {
    await LocalNotifications.schedule({ notifications: toSchedule });
  } catch (err) {
    console.error('[mealReminders] schedule failed', err);
  }
}

/**
 * Fire a one-off native notification immediately (drops into the system
 * notification drawer). Safe to call on web — no-ops outside Capacitor native.
 * Requests POST_NOTIFICATIONS permission if not yet granted.
 */
export async function fireImmediateNotification(opts: {
  id: number;
  title: string;
  body: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id,
          title: opts.title,
          body: opts.body,
          schedule: { at: new Date(Date.now() + 500) },
          smallIcon: 'ic_launcher',
      largeIcon: 'ic_launcher',
        },
      ],
    });
  } catch (err) {
    console.error('[fireImmediateNotification] schedule failed', err);
  }
}

export const CALORIE_GOAL_NOTIFICATION_ID = 2001;
