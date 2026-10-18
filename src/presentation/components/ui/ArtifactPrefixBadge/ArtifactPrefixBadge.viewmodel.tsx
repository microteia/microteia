import { useCallback, useContext } from 'react';
import { useOptionalAuthorization } from '../../../../stores/useAuthorization';
import { WorkspaceContext } from '../../../../stores/useWorkspace';
import { PERMISSION_TENANT_PREFIX_MANAGE } from '../../../../domain/schema/access';
import type { PrefixedNameKind } from '../../../../domain/schema/plugin/artifactPrefix';
import { prefixHead } from '../../../../domain/schema/plugin/artifactPrefix';
import { settingsTabKey } from '../../../shared/settings/settingsTabKey';
import { PREFIX_SETTINGS_SECTION } from '../../../shared/settings/useArtifactPrefix';

export interface ArtifactPrefixBadgeViewModel {
  /** O começo fixo do nome — `abcd_` ou `abcd-` —, ou `null` quando o escritório ainda não tem prefixo. */
  head: string | null;
  /** Quem pode trocar o prefixo vê o atalho para a seção dele em Configurações. */
  canChange: boolean;
  openPrefixSettings: () => void;
}

/**
 * O atalho só existe para quem tem `tenant.change-prefix` e dentro do workspace. Fora dele (um teste,
 * uma pré-visualização), o selo só mostra o prefixo.
 */
export const useArtifactPrefixBadgeViewModel = (
  prefix: string | null,
  kind: PrefixedNameKind,
): ArtifactPrefixBadgeViewModel => {
  const authorization = useOptionalAuthorization();
  const workspace = useContext(WorkspaceContext);
  const canChange = !!workspace && !!authorization?.can(PERMISSION_TENANT_PREFIX_MANAGE);
  const openTab = workspace?.openTab;

  const openPrefixSettings = useCallback(() => {
    openTab?.(settingsTabKey('tenant', PREFIX_SETTINGS_SECTION));
  }, [openTab]);

  return { head: prefix ? prefixHead(prefix, kind) : null, canChange, openPrefixSettings };
};
