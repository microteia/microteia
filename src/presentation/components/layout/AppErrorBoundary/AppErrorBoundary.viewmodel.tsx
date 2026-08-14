import { useCallback } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';

export interface AppErrorBoundaryViewModel {
  handleError: (error: Error) => void;
  handleReload: () => void;
}

export const useAppErrorBoundaryViewModel = (): AppErrorBoundaryViewModel => {
  const { auditLogService } = useDI();
  const { currentTenant } = useTenant();

  const handleError = useCallback((error: Error) => {
    void auditLogService.logError({
      tenantId: currentTenant?.id ?? 'SYSTEM',
      title: 'Unhandled interface error',
      entity: 'FRONTEND',
      error,
    });
  }, [auditLogService, currentTenant]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return { handleError, handleReload };
};
