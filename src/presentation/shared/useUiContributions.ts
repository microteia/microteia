import React, { useMemo } from 'react';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import { useContributions, useKernel } from '../../stores/useKernel';
import type { ICommandPaletteProvider } from '../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import { resolvePageContribution } from './resolveUiContributions';
import type { UiPageMetadata } from './uiExtensionPoints';
import { UI_COMMAND_POINT, UI_NAV_POINT, UI_PAGE_POINT } from './uiExtensionPoints';

export type PageComponent = React.ComponentType<{ tabKey: string }>;

export interface ResolvedPage {
  metadata: UiPageMetadata;
  Component: PageComponent | undefined;
}

export const usePageContributions = (): QualifiedContribution[] => useContributions(UI_PAGE_POINT);

export const useNavContributions = (): QualifiedContribution[] => useContributions(UI_NAV_POINT);

export const useResolvePage = (): ((tabKey: string) => ResolvedPage | undefined) => {
  const { host } = useKernel();
  const contributions = usePageContributions();

  return useMemo(
    () => (tabKey: string) => {
      const contribution = resolvePageContribution(contributions, tabKey);
      if (!contribution) return undefined;
      const Component =
        contribution.impl?.kind === 'code'
          ? host.implementations.resolve<PageComponent>(contribution.pluginId, contribution.impl.key)
          : undefined;
      return { metadata: contribution.metadata as unknown as UiPageMetadata, Component };
    },
    [contributions, host],
  );
};

export const useCommandProviders = (): ICommandPaletteProvider[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_COMMAND_POINT);

  return useMemo(
    () =>
      contributions.flatMap((contribution) => {
        if (contribution.impl?.kind !== 'code') return [];
        const provider = host.implementations.resolve<ICommandPaletteProvider>(
          contribution.pluginId,
          contribution.impl.key,
        );
        return provider ? [provider] : [];
      }),
    [contributions, host],
  );
};
