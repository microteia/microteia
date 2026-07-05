import { useTenant } from '../../../../stores/useTenant';
import { TENANT_PLAN_LABELS } from '../../../../domain/entities';

export interface WorkspaceStatusBarViewModel {
  tenantName: string | null;
  planLabel: string | null;
  memberCount: number | null;
  memberLimit: number | null;
  version: string;
}

export const useWorkspaceStatusBarViewModel = (): WorkspaceStatusBarViewModel => {
  const { currentTenant } = useTenant();

  return {
    tenantName: currentTenant?.name ?? null,
    planLabel: currentTenant ? TENANT_PLAN_LABELS[currentTenant.plan] : null,
    memberCount: currentTenant?.memberCount ?? null,
    memberLimit: currentTenant?.memberLimit ?? null,
    version: __APP_VERSION__,
  };
};
