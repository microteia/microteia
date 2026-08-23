import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { useAuthorization } from './useAuthorization';
import { PERMISSION_AUDIT_READ } from '../domain/schema/access';
import { makeGetAuditLogReadCursorUseCase } from '../domain/usecases/auditlogs/GetAuditLogReadCursorUseCase';
import { makeMarkAllCriticalAuditLogsAsReadUseCase } from '../domain/usecases/auditlogs/MarkAllCriticalAuditLogsAsReadUseCase';
import { makeSubscribeToCriticalUnreadUseCase } from '../domain/usecases/auditlogs/SubscribeToCriticalUnreadUseCase';
import { AuditLogAlertContext } from './useAuditLogAlert';

const EPOCH = new Date(0);

export const AuditLogAlertStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auditLogRepository } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();

  const [unreadCriticalCount, setUnreadCriticalCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<Date>(EPOCH);

  const uc = useMemo(() => ({
    getCursor: makeGetAuditLogReadCursorUseCase(auditLogRepository),
    markAllRead: makeMarkAllCriticalAuditLogsAsReadUseCase(auditLogRepository),
    subscribe: makeSubscribeToCriticalUnreadUseCase(auditLogRepository),
  }), [auditLogRepository]);

  const canMonitor = Boolean(user && currentTenant && can(PERMISSION_AUDIT_READ));

  useEffect(() => {
    if (!canMonitor || !user || !currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when losing tenant/permission is architecturally required
      setLastReadAt(EPOCH);
      setUnreadCriticalCount(0);
      return;
    }

    uc.getCursor.execute(user.id, currentTenant.id)
      .then((cursor) => setLastReadAt(cursor?.lastReadAt ?? EPOCH))
      .catch(() => setLastReadAt(EPOCH));
  }, [canMonitor, user, currentTenant, uc]);

  useEffect(() => {
    if (!canMonitor || !currentTenant) return;

    const unsub = uc.subscribe.execute(currentTenant.id, lastReadAt, setUnreadCriticalCount);
    return () => unsub();
  }, [canMonitor, currentTenant, lastReadAt, uc]);

  const markAllAsRead = useCallback(async () => {
    if (!user || !currentTenant || !canMonitor || unreadCriticalCount === 0) return;

    const cursor = await uc.markAllRead.execute(user.id, currentTenant.id);
    setLastReadAt(cursor.lastReadAt);
  }, [user, currentTenant, canMonitor, uc, unreadCriticalCount]);

  return (
    <AuditLogAlertContext.Provider value={{ unreadCriticalCount, markAllAsRead }}>
      {children}
    </AuditLogAlertContext.Provider>
  );
};
