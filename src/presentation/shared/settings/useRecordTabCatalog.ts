import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useSettings } from '../../../stores/useSettings';
import { recordSurface } from '../../../domain/schema/ui/uiExtensionPoints';
import {
  resolveContributionLayout,
  resolveSetting,
  type ContributionLayoutDefaults,
  type ContributionLayoutEntry,
} from '../../../domain/schema/settings';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';
import { childTabKey, childTabScreens, screenSourceIdOf } from '../../../domain/services/recordTabs';
import type { ScreenDefinition } from '../../../domain/entities';
import { useSettingsSections, useSurfaceTabs, type SurfaceTabDescriptor } from './useSettingsCatalog';
import { surfaceTabsProperty } from './useSettingValue';
import { useLabel } from '../i18n/useT';

/**
 * Uma aba da faixa do detalhe de um registro, além de Dados, Anotações e Documentos: a de uma
 * tela-filha ou a que uma extensão contribuiu. As duas entram na MESMA lista, com a mesma chave na
 * configuração e no detalhe — é o que deixa o escritório ligar, desligar e ordenar as duas do mesmo
 * jeito.
 */
export interface RecordTabCatalogItem extends ContributionLayoutDefaults {
  title: string;
  description?: string;
  icon?: string;
  pluginId: string;
  childScreen: ScreenDefinition | null;
  tab: SurfaceTabDescriptor | null;
}

/**
 * O catálogo da faixa de uma tela, na ordem PADRÃO: telas-filhas primeiro, depois as contribuídas
 * pela ordem delas — o que a faixa mostrava antes de a configuração existir, e o que continua
 * mostrando para quem nunca a tocou. A posição vira `order` explícito porque as duas origens não
 * compartilham uma escala de ordem.
 *
 * Anotações e Documentos não entram: são ligadas pela Form Design da própria tela (`hasNotes`,
 * `hasDocuments`), e uma segunda chave para a mesma decisão faria as duas discordarem.
 */
export const useRecordTabCatalog = (screenSourceId: string): RecordTabCatalogItem[] => {
  const { dynamicScreens } = useScreenDefinitions();
  const contributed = useSurfaceTabs(screenSourceId ? recordSurface(screenSourceId) : '');
  const label = useLabel();

  return useMemo(() => {
    if (!screenSourceId) return [];
    const parent = dynamicScreens.find((screen) => screenSourceIdOf(screen) === screenSourceId);
    const children = parent ? childTabScreens(dynamicScreens, screenDataCollection(parent)) : [];

    const items: Omit<RecordTabCatalogItem, 'order'>[] = [
      ...children.map((screen) => ({
        key: childTabKey(screen),
        title: label(screen.titlePlural || screen.titleSingular),
        icon: screen.icon,
        pluginId: screen.ownerPluginId ?? '',
        defaultEnabled: true,
        childScreen: screen,
        tab: null,
      })),
      ...contributed.map((tab) => ({
        key: tab.key,
        title: tab.title,
        description: tab.description,
        icon: tab.icon,
        pluginId: tab.pluginId,
        defaultEnabled: tab.defaultEnabled !== false,
        childScreen: null,
        tab,
      })),
    ];
    return items.map((item, index) => ({ ...item, order: index }));
  }, [screenSourceId, dynamicScreens, contributed, label]);
};

/** O catálogo conciliado com `record:<sourceId>.tabs` — a ordem e o liga/desliga em vigor. */
export const useRecordTabLayout = (screenSourceId: string): {
  catalog: RecordTabCatalogItem[];
  entries: ContributionLayoutEntry[];
} => {
  const catalog = useRecordTabCatalog(screenSourceId);
  const sections = useSettingsSections();
  const { values } = useSettings();

  const entries = useMemo(() => {
    if (!screenSourceId) return [];
    const property = surfaceTabsProperty(sections, recordSurface(screenSourceId));
    return resolveContributionLayout(resolveSetting(property, values).value, catalog);
  }, [screenSourceId, sections, values, catalog]);

  return { catalog, entries };
};
