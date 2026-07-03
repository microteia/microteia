import { createContext, useContext } from 'react';

export interface AuditLogAlertContextValue {
  unreadCriticalCount: number;
  markAllAsRead: () => Promise<void>;
}

export const AuditLogAlertContext = createContext<AuditLogAlertContextValue | null>(null);

export const useAuditLogAlert = (): AuditLogAlertContextValue => {
  const ctx = useContext(AuditLogAlertContext);
  if (!ctx) throw new Error('useAuditLogAlert must be used within AuditLogAlertStoreProvider');
  return ctx;
};
