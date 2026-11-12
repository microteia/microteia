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
  makeCreatePersonalReportUseCase,
  makeDeletePersonalReportUseCase,
  makeGetPersonalReportsUseCase,
  makeSharePersonalReportUseCase,
  makeSubscribeToPersonalReportsUseCase,
  makeUpdatePersonalReportUseCase,
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
  const { reportRepository, personalReportRepository } = useDI();

  const [tenantReports, setTenantReports] = useState<ReportDefinition[]>([]);
  const [personalReports, setPersonalReports] = useState<ReportDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const userId = user?.id ?? null;

  const uc = useMemo(() => ({
    get: makeGetReportsUseCase(reportRepository),
    subscribe: makeSubscribeToReportsUseCase(reportRepository),
    create: makeCreateReportUseCase(reportRepository),
    update: makeUpdateReportUseCase(reportRepository),
    delete: makeDeleteReportUseCase(reportRepository),
    run: makeRunReportUseCase(reportRepository),
    getPersonal: makeGetPersonalReportsUseCase(personalReportRepository),
    subscribePersonal: makeSubscribeToPersonalReportsUseCase(personalReportRepository),
    createPersonal: makeCreatePersonalReportUseCase(personalReportRepository),
    updatePersonal: makeUpdatePersonalReportUseCase(personalReportRepository),
    deletePersonal: makeDeletePersonalReportUseCase(personalReportRepository),
    sharePersonal: makeSharePersonalReportUseCase(personalReportRepository),
  }), [reportRepository, personalReportRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const [shared, personal] = await Promise.all([
        uc.get.execute(currentTenant.id),
        userId ? uc.getPersonal.execute(currentTenant.id, userId) : Promise.resolve([]),
      ]);
      setTenantReports(shared);
      setPersonalReports(personal);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, userId, uc.get, uc.getPersonal]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setTenantReports([]);
      return;
    }
    setIsLoading(true);
    const unsub = uc.subscribe.execute(currentTenant.id, (list) => {
      setTenantReports(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentTenant, uc.subscribe]);

  useEffect(() => {
    if (!currentTenant || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setPersonalReports([]);
      return;
    }
    return uc.subscribePersonal.execute(currentTenant.id, userId, setPersonalReports);
  }, [currentTenant, userId, uc.subscribePersonal]);

  const reports = useMemo(() => [...tenantReports, ...personalReports], [tenantReports, personalReports]);
  const isPersonal = useCallback(
    (reportId: string | undefined) => !!reportId && personalReports.some((report) => report.id === reportId),
    [personalReports],
  );

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.REPORTS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  // O do ESCRITÓRIO vence quando as chaves colidem: um relatório do escritório criado depois com a chave
  // de um pessoal não pode ficar inalcançável para todos os outros membros.
  const getReport = useCallback(
    (key: string) => tenantReports.find((report) => report.key === key || report.id === key)
      ?? personalReports.find((report) => report.key === key || report.id === key),
    [tenantReports, personalReports],
  );

  const createReport = useCallback(async (data: ReportSaveInput, id?: string, options?: { personal?: boolean }) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    if (options?.personal) {
      if (!userId) throw new LocalizedError('@core.ui/tenant.none-selected');
      const created = await uc.createPersonal.execute(currentTenant.id, userId, data);
      storeEvents.emit(StoreEvents.REPORTS_UPDATED);
      return created;
    }
    const created = await uc.create.execute(currentTenant.id, { ...data, createdBy: userId }, id);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
    return created;
  }, [currentTenant, userId, uc.create, uc.createPersonal]);

  const updateReport = useCallback(async (reportId: string, data: Partial<ReportSaveInput>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    if (isPersonal(reportId)) await uc.updatePersonal.execute(currentTenant.id, reportId, data);
    else await uc.update.execute(currentTenant.id, reportId, data);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
  }, [currentTenant, isPersonal, uc.update, uc.updatePersonal]);

  const deleteReport = useCallback(async (reportId: string) => {
    if (!currentTenant) return;
    if (isPersonal(reportId)) await uc.deletePersonal.execute(currentTenant.id, reportId);
    else await uc.delete.execute(currentTenant.id, reportId);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
  }, [currentTenant, isPersonal, uc.delete, uc.deletePersonal]);

  const shareReport = useCallback(async (reportId: string, key: string) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    await uc.sharePersonal.execute(currentTenant.id, reportId, key);
    storeEvents.emit(StoreEvents.REPORTS_UPDATED);
  }, [currentTenant, uc.sharePersonal]);

  // Quem chama passa o `report.id` que tem na mão; é aqui que se sabe de qual coleção ele é.
  const runReport = useCallback(async (input: Omit<RunReportInput, 'tenantId'>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    return uc.run.execute({ ...input, tenantId: currentTenant.id, ...(isPersonal(input.reportId) ? { personal: true } : {}) });
  }, [currentTenant, isPersonal, uc.run]);

  return (
    <ReportDefinitionContext.Provider value={{
      reports,
      isLoading,
      getReport,
      createReport,
      updateReport,
      deleteReport,
      shareReport,
      runReport,
      refresh,
    }}>
      {children}
    </ReportDefinitionContext.Provider>
  );
};
