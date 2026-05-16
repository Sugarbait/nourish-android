'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export const DEFAULT_NOTIFICATION_PREFS = {
  mealReminders: true,
  goalNudges: true,
  creditResetAlert: true,
  coachInsights: true,
  broadcastEmails: true,
};

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type?: 'info' | 'success' | 'warning', duration?: number) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addNotification = useCallback((
    message: string,
    type: 'info' | 'success' | 'warning' = 'info',
    duration: number = 4000
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, []);

  // Clean up all timers on unmount
  const timers = timersRef.current;
  React.useEffect(() => {
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, [timers]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
}
