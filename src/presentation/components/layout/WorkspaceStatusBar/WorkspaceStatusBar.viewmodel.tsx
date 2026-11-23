import { useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { usePlan } from '../../../../stores/usePlan';

import { useLabel } from '../../../shared/i18n/useT';
export interface WorkspaceStatusBarViewModel {
  tenantName: string | null;
  planLabel: string | null;
  memberCount: number | null;
  memberLimit: number | null;
  version: string;
  /**
   * Abre os Termos como ABA, e não numa janela nova. A rota pública mostra só o contrato da
   * Microteia; a aba mostra também o termo de cada extensão no ar aqui, que é o que vale para quem
   * está dentro deste escritório. Ver `usePluginLicenses`.
   */
  openTerms: () => void;
}

export const useWorkspaceStatusBarViewModel = (): WorkspaceStatusBarViewModel => {
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { currentPlan } = usePlan();
  const { openTab } = useWorkspace();

  const openTerms = useCallback(() => openTab('license'), [openTab]);

  return {
    tenantName: currentTenant?.name ?? null,
    // O nome do plano é dado do `SYSTEM` (#24): passa por `useLabel()` intacto, ou resolve a referência
    // `@ns/chave` dos planos que vieram da lista fixa de antes.
    planLabel: currentTenant && currentPlan ? label(currentPlan.name) : null,
    memberCount: currentTenant?.memberCount ?? null,
    memberLimit: currentTenant?.memberLimit ?? null,
    version: __APP_VERSION__,
    openTerms,
  };
};
