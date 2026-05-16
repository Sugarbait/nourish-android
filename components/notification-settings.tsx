'use client';

import { useState } from 'react';
import { DEFAULT_NOTIFICATION_PREFS } from './notification-context';

interface NotificationPreferences {
  mealReminders: boolean;
  goalNudges: boolean;
  creditResetAlert: boolean;
  coachInsights: boolean;
  broadcastEmails: boolean;
}

interface NotificationSettingsProps {
  preferences: NotificationPreferences | undefined;
  onSave: (preferences: NotificationPreferences) => Promise<void>;
}

export function NotificationSettings({ preferences, onSave }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationPreferences>(
    preferences ?? DEFAULT_NOTIFICATION_PREFS
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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
      description: 'Reminded at breakfast (8 AM), lunch (12 PM), and dinner (6 PM)',
    },
    {
      key: 'goalNudges' as const,
      label: 'Goal Progress Nudges',
      description: 'Notified when you\'re halfway or close to hitting daily targets',
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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(({ key, label, description }) => (
          <div
            key={key}
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
