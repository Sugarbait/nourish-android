'use client';

import { useState } from 'react';
import { DEFAULT_NOTIFICATION_PREFS } from './notification-context';
import { DEFAULT_MEAL_TIMES, type MealReminderTimes } from '@/lib/mealReminders';

interface NotificationPreferences {
  mealReminders: boolean;
  goalNudges: boolean;
  creditResetAlert: boolean;
  coachInsights: boolean;
  broadcastEmails: boolean;
  calorieGoalReached: boolean;
  mealReminderTimes?: MealReminderTimes;
}

interface NotificationSettingsProps {
  preferences: NotificationPreferences | undefined;
  onSave: (preferences: NotificationPreferences) => Promise<void>;
}

export function NotificationSettings({ preferences, onSave }: NotificationSettingsProps) {
  // Merge defaults with saved prefs so new fields (e.g. broadcastEmails) added
  // after a user's profile was last written still render as ticked by default.
  const [settings, setSettings] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(preferences ?? {}),
    mealReminderTimes: {
      ...DEFAULT_MEAL_TIMES,
      ...(preferences?.mealReminderTimes ?? {}),
    },
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTimeChange = (meal: keyof MealReminderTimes, value: string) => {
    setSettings(prev => ({
      ...prev,
      mealReminderTimes: {
        ...DEFAULT_MEAL_TIMES,
        ...(prev.mealReminderTimes ?? {}),
        [meal]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const items = [
    {
      key: 'mealReminders' as const,
      label: 'Meal Reminders',
      description: 'Daily reminders for breakfast, lunch, and dinner at the times you choose below.',
    },
    {
      key: 'goalNudges' as const,
      label: 'Goal Progress Nudges',
      description: 'Notified when you\'re halfway or close to hitting daily targets',
    },
    {
      key: 'calorieGoalReached' as const,
      label: 'Calorie Goal Reached',
      description: 'A notification when you hit your daily calorie goal',
    },
    {
      key: 'creditResetAlert' as const,
      label: 'Monthly Credit Reset',
      description: 'Alert when your 300 credits refresh each month',
    },
    {
      key: 'coachInsights' as const,
      label: 'AI Coach Insights',
      description: 'Preview of your coach\'s response after each message',
    },
    {
      key: 'broadcastEmails' as const,
      label: 'Product & Promotional Emails',
      description: 'Occasional announcements, tips, and offers from the Nourish team',
    },
  ];

  const times = settings.mealReminderTimes ?? DEFAULT_MEAL_TIMES;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(({ key, label, description }) => (
          <div key={key}>
            <div
              className="flex items-start gap-3 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
              onClick={() => handleToggle(key)}
            >
              <div
                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                  settings[key] ? 'bg-primary border-primary' : 'border-white/20'
                }`}
              >
                {settings[key] && <div className="w-1.5 h-1.5 bg-primary-foreground rounded-sm" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>

            {key === 'mealReminders' && settings.mealReminders && (
              <div className="mt-2 ml-8 mr-1 p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                {([
                  { id: 'breakfast', label: 'Breakfast' },
                  { id: 'lunch',     label: 'Lunch'     },
                  { id: 'dinner',    label: 'Dinner'    },
                ] as const).map(({ id, label }) => (
                  <div key={id} className="flex items-center justify-between gap-3">
                    <label htmlFor={`meal-time-${id}`} className="text-xs text-muted-foreground">
                      {label}
                    </label>
                    <input
                      id={`meal-time-${id}`}
                      type="time"
                      value={times[id]}
                      onChange={(e) => handleTimeChange(id, e.target.value)}
                      className="bg-background border border-white/10 rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
