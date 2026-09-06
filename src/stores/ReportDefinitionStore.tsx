import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ReportDefinitionContext } from './useReportDefinitions';
import type { ReportSaveInput } from './useReportDefinitions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import {
  makeCreateReportUseCase,
  makeDeleteReportUseCase,
  makeGetReportsUseCase,
  makeRunReportUseCase,
  makeSubscribeToReportsUseCase,
  makeUpdateReportUseCase,
} from '../domain/usecases/reports/ReportUseCases';
import type { ReportDefinition } from '../domain/entities/Report';
import type { RunReportInput } from '../domain/repositories/IReportDefinitionRepository';
import { LocalizedError } from '../domain/errors/LocalizedError';

/**
 * Os relatórios do escritório.
 *
 * Guarda a DEFINIÇÃO, nunca o resultado: cada execução é uma chamada ao servidor, porque é lá que a
 * leitura de cada coleção é cobrada e é lá que a agregação acontece — os registros varridos não
 * atravessam a rede.
 */
export const ReportDefinitionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { reportRepository } = useDI();

  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetReportsUseCase(reportRepository),
    subscribe: makeSubscribeToReportsUseCase(reportRepository),
    create: makeCreateReportUseCase(reportRepository),
    update: makeUpdateReportUseCase(reportRepository),
    delete: makeDeleteReportUseCase(reportRepository),
    run: makeRunReportUseCase(reportRepository),
  }), [reportRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      setReports(await uc.get.execute(currentTenant.id));
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setReports([]);
      return;
    }
    setIsLoading(true);
    const unsub = uc.subscribe.execute(currentTenant.id, (list) => {
      setReports(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentTenant, uc.subscribe]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.REPORTS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const getReport = useCallback(
    (key: string) => reports.find((report) => report.key === key || report.id === key),
    [reports],
  );

  const createReport = useCallback(async (data: ReportSaveInput, id?: string) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    const created = await uc.create.execute(currentTenant.id, { ...data, createdBy: user?.id ?? null }, id);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
    return created;
  }, [currentTenant, user, uc.create]);

  const updateReport = useCallback(async (reportId: string, data: Partial<ReportSaveInput>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    await uc.update.execute(currentTenant.id, reportId, data);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteReport = useCallback(async (reportId: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, reportId);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
  }, [currentTenant, uc.delete]);

  const runReport = useCallback(async (input: Omit<RunReportInput, 'tenantId'>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    return uc.run.execute({ ...input, tenantId: currentTenant.id });
  }, [currentTenant, uc.run]);

  return (
    <ReportDefinitionContext.Provider value={{
      reports,
      isLoading,
      getReport,
      createReport,
      updateReport,
      deleteReport,
      runReport,
      refresh,
    }}>
      {children}
    </ReportDefinitionContext.Provider>
  );
};
