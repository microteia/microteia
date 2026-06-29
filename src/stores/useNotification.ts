import { createContext, useContext } from 'react';

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  variant: NotificationVariant;
  message: string;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  notify: (message: string, variant: NotificationVariant) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};
