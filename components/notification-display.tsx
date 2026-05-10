'use client';

import { useNotification } from './notification-context';
import { X, CheckCircle, Info, AlertCircle } from 'lucide-react';

export function NotificationDisplay() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {notifications.map((notification) => {
        const bgColor = {
          success: 'bg-emerald-500/10 border-emerald-500/30',
          warning: 'bg-amber-500/10 border-amber-500/30',
          info: 'bg-primary/10 border-primary/30',
        }[notification.type];

        const textColor = {
          success: 'text-emerald-400',
          warning: 'text-amber-400',
          info: 'text-primary',
        }[notification.type];

        const Icon = {
          success: CheckCircle,
          warning: AlertCircle,
          info: Info,
        }[notification.type];

        return (
          <div
            key={notification.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm ${bgColor} pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-200`}
          >
            <Icon className={`h-5 w-5 ${textColor} flex-shrink-0 mt-0.5`} />
            <p className="text-sm text-foreground flex-1">{notification.message}</p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
