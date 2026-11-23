import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeMigrateLegacyPlansUseCase } from '../../../domain/usecases/plans/PlanUseCases';

export type AccessManagementTab = 'users' | 'offices' | 'plans';

export interface AccessManagementViewModel {
  isUnauthorized: boolean;
  /** A migração dos planos de antes terminou (ou falhou) — as abas que leem planos já podem abrir. */
  plansReady: boolean;
  activeTab: AccessManagementTab;
  setActiveTab: (tab: AccessManagementTab) => void;
}

export const useAccessManagementViewModel = (): AccessManagementViewModel => {
  const { user, userRole } = useAuth();
  const { planRepository, tenantRepository, registrationPolicyRepository } = useDI();
  const isUnauthorized = userRole !== 'SYSTEM';
  const [activeTab, setActiveTab] = useState<AccessManagementTab>('users');
  const [plansReady, setPlansReady] = useState(false);

  const migrateLegacyPlans = useMemo(
    () => makeMigrateLegacyPlansUseCase(planRepository, tenantRepository, registrationPolicyRepository),
    [planRepository, tenantRepository, registrationPolicyRepository],
  );

  /**
   * Os planos que o kernel trazia fixos viram documento quando o `SYSTEM` abre esta tela (#24) — a
   * única tela que só ele vê, e a que lê planos. As abas esperam a migração para não listar um
   * escritório num plano que acabou de nascer. Falhar não trava a tela: os planos que faltarem
   * aparecem como "não cadastrado", e a migração tenta de novo na próxima vez.
   */
  useEffect(() => {
    if (isUnauthorized || !user) return;
    let active = true;
    migrateLegacyPlans.execute(user.id)
      .catch(() => undefined)
      .finally(() => { if (active) setPlansReady(true); });
    return () => { active = false; };
  }, [isUnauthorized, user, migrateLegacyPlans]);

  const handleSetActiveTab = useCallback((tab: AccessManagementTab) => {
    setActiveTab(tab);
  }, []);

  return {
    isUnauthorized,
    plansReady,
    activeTab,
    setActiveTab: handleSetActiveTab,
  };
};
