import { useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { TENANT_PLAN_LABELS } from '../../../../domain/entities';

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
  const { openTab } = useWorkspace();

  const openTerms = useCallback(() => openTab('license'), [openTab]);

  return {
    tenantName: currentTenant?.name ?? null,
    planLabel: currentTenant ? label(TENANT_PLAN_LABELS[currentTenant.plan]) : null,
    memberCount: currentTenant?.memberCount ?? null,
    memberLimit: currentTenant?.memberLimit ?? null,
    version: __APP_VERSION__,
    openTerms,
  };
};
