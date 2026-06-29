import React, { useState, useCallback } from 'react';
import { NotificationContext } from './useNotification';
import type { AppNotification, NotificationVariant } from './useNotification';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback((message: string, variant: NotificationVariant) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications(prev => [{ id, variant, message }, ...prev].slice(0, 10));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, dismissAll }}>
      {children}
    </NotificationContext.Provider>
  );
};
