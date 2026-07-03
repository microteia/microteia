import { useTenant } from '../../../../stores/useTenant';

export interface WorkspaceStatusBarViewModel {
  tenantName: string | null;
  version: string;
}

export const useWorkspaceStatusBarViewModel = (): WorkspaceStatusBarViewModel => {
  const { currentTenant } = useTenant();

  return {
    tenantName: currentTenant?.name ?? null,
    version: __APP_VERSION__,
  };
};
