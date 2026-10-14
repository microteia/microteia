import React, { useMemo } from 'react';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import { useContributions, useKernel } from '../../stores/useKernel';
import type { ICommandPaletteProvider } from '../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import { WidgetRenderer } from '../components/ui/WidgetRenderer';
import { evaluateExtensionView } from './extensions/evaluateExtensionView';
import { useExtensionCommandProviders } from './extensions/extensionServices';
import { isExtensionViewRef } from '../../domain/usecases/plugins/extensionViewRef';
import { resolvePageContribution } from './resolveUiContributions';
import type { UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import { UI_COMMAND_POINT, UI_NAV_GROUP_POINT, UI_NAV_POINT, UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';

export type PageComponent = React.ComponentType<{ tabKey: string }>;

export interface ResolvedPage {
  metadata: UiPageMetadata;
  Component: PageComponent | undefined;
}

export const usePageContributions = (): QualifiedContribution[] => useContributions(UI_PAGE_POINT);

export const useNavContributions = (): QualifiedContribution[] => useContributions(UI_NAV_POINT);

export const useNavGroupContributions = (): QualifiedContribution[] => useContributions(UI_NAV_GROUP_POINT);

// Um componente só, de módulo, para toda página em Widget DSL: a identidade não muda entre renders,
// então o painel não desmonta a página (nem perde o estado dos filtros) quando o espaço de trabalho muda.
const WidgetPage: PageComponent = ({ tabKey }) => {
  const contributions = usePageContributions();
  const impl = resolvePageContribution(contributions, tabKey)?.impl;
  return React.createElement(WidgetRenderer, { spec: impl?.kind === 'widget' ? impl.spec : undefined });
};

export const useResolvePage = (): ((tabKey: string) => ResolvedPage | undefined) => {
  const { host } = useKernel();
  const contributions = usePageContributions();

  return useMemo(
    () => (tabKey: string) => {
      const contribution = resolvePageContribution(contributions, tabKey);
      if (!contribution) return undefined;

      let Component: PageComponent | undefined;
      if (contribution.impl?.kind === 'code') {
        const impl = host.implementations.resolve<unknown>(contribution.pluginId, contribution.impl.key);
        // Plugin interno (bundle) devolve o componente direto; extensão trusted devolve um marcador
        // `ExtensionViewRef`, cuja fonte é compilada e avaliada aqui, sob demanda.
        Component = isExtensionViewRef(impl)
          ? evaluateExtensionView(`${impl.pluginId}::${impl.viewKey}`, impl.source)
          : (impl as PageComponent | undefined);
      } else if (contribution.impl?.kind === 'widget') {
        // Plugin de terceiro entrega tela declarativa: o Kernel a renderiza, sem JS do plugin.
        Component = WidgetPage;
      }
      return { metadata: contribution.metadata as unknown as UiPageMetadata, Component };
    },
    [contributions, host],
  );
};

export const useCommandProviders = (): ICommandPaletteProvider[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_COMMAND_POINT);
  const extensionProviders = useExtensionCommandProviders();

  return useMemo(
    () => [
      ...contributions.flatMap((contribution) => {
        if (contribution.impl?.kind !== 'code') return [];
        const provider = host.implementations.resolve<ICommandPaletteProvider>(
          contribution.pluginId,
          contribution.impl.key,
        );
        return provider ? [provider] : [];
      }),
      ...extensionProviders,
    ],
    [contributions, host, extensionProviders],
  );
};
