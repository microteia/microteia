import { createContext, useContext } from 'react';
import type { AuditLog } from '../domain/entities';

export interface AuditLogFilters {
  /** null = todos os escritórios (somente para usuários SYSTEM) */
  tenantId: string | null;
}

export interface AuditLogContextValue {
  logs: AuditLog[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  search: (filters: AuditLogFilters) => Promise<void>;
  loadMore: () => Promise<void>;
}

export const AuditLogContext = createContext<AuditLogContextValue | null>(null);

export const useAuditLogStore = (): AuditLogContextValue => {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAuditLogStore must be used within AuditLogStoreProvider');
  return ctx;
};
