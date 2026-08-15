import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { makeGetAuditLogsUseCase } from '../domain/usecases/auditlogs/GetAuditLogsUseCase';
import { AuditLogContext, type AuditLogFilters } from './useAuditLogStore';
import type { AuditLog } from '../domain/entities';

const PAGE_SIZE = 25;

export const AuditLogStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auditLogRepository } = useDI();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuditLogs = useMemo(() => makeGetAuditLogsUseCase(auditLogRepository), [auditLogRepository]);

  const filtersRef = useRef<AuditLogFilters | null>(null);
  const cursorRef = useRef<unknown>(null);

  const search = useCallback(async (filters: AuditLogFilters) => {
    filtersRef.current = filters;
    cursorRef.current = null;
    setLoading(true);
    setError(null);
    try {
      const page = await getAuditLogs.execute({ ...filters, pageSize: PAGE_SIZE });
      setLogs(page.logs);
      setHasMore(page.hasMore);
      cursorRef.current = page.nextCursor;
    } catch (err) {
      console.error('[AuditLogStore] Falha ao buscar registros de auditoria:', err);
      setError('@core.admin/audit.load-failed');
    } finally {
      setLoading(false);
    }
  }, [getAuditLogs]);

  const loadMore = useCallback(async () => {
    if (!filtersRef.current || !hasMore || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getAuditLogs.execute({
        ...filtersRef.current,
        pageSize: PAGE_SIZE,
        cursor: cursorRef.current,
      });
      setLogs((prev) => [...prev, ...page.logs]);
      setHasMore(page.hasMore);
      cursorRef.current = page.nextCursor;
    } catch (err) {
      console.error('[AuditLogStore] Falha ao carregar mais registros de auditoria:', err);
      setError('@core.admin/audit.load-more-failed');
    } finally {
      setLoading(false);
    }
  }, [getAuditLogs, hasMore, loading]);

  useEffect(() => {
    const handle = () => {
      if (!document.hidden && filtersRef.current) void search(filtersRef.current);
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [search]);

  return (
    <AuditLogContext.Provider value={{ logs, loading, hasMore, error, search, loadMore }}>
      {children}
    </AuditLogContext.Provider>
  );
};
