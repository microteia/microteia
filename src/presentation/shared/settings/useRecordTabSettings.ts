import { useMemo } from 'react';
import { useContributions } from '../../../stores/useKernel';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import {
  UI_TAB_POINT,
  recordSurface,
  recordSurfaceSourceId,
} from '../../../domain/schema/ui/uiExtensionPoints';
import type { SettingsProperty, SettingsSection } from '../../../domain/schema/settings';
import { surfaceTabsProperty } from './useSettingValue';
import { useLabel, useLocaleFormat, useT } from '../i18n/useT';

export const RECORD_TABS_SECTION_KEY = 'record-tabs';

/**
 * A seção de Configurações que liga, desliga e ordena as abas contribuídas no detalhe de um registro.
 *
 * Existe derivada, e não declarada, porque a superfície é UMA POR TELA: nenhum manifest sabe de
 * antemão quais telas o escritório tem, e uma propriedade só faz sentido para a tela que de fato
 * recebeu aba. Cada propriedade é a MESMA de `surfaceTabsProperty` — a mesma chave
 * `record:<sourceId>.tabs` que o detalhe lê —, com o nome da tela no rótulo para o escritório saber
 * de qual se trata. Tela cuja propriedade alguém já declarou fica de fora: a declarada vence, como em
 * toda superfície.
 *
 * `declared` são as seções que já existem, para que a derivada não repita uma propriedade.
 */
export const useRecordTabSettingsSection = (declared: SettingsSection[]): SettingsSection | null => {
  const contributions = useContributions(UI_TAB_POINT);
  const { dynamicScreens } = useScreenDefinitions();
  const t = useT('core.settings');
  const label = useLabel();
  const { compareText } = useLocaleFormat();

  return useMemo(() => {
    const sourceIds = new Set<string>();
    for (const contribution of contributions) {
      const surface = contribution.metadata.surface;
      const sourceId = typeof surface === 'string' ? recordSurfaceSourceId(surface) : null;
      if (sourceId) sourceIds.add(sourceId);
    }

    const properties = Array.from(sourceIds).flatMap((sourceId): SettingsProperty[] => {
      const surface = recordSurface(sourceId);
      const property = surfaceTabsProperty(declared, surface);
      if (declared.some((section) => section.properties.includes(property))) return [];
      const screen = dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId);
      return [{
        ...property,
        label: screen ? label(screen.titlePlural || screen.titleSingular) : sourceId,
        description: t('settings.record-tabs.property'),
      }];
    });

    if (properties.length === 0) return null;
    return {
      key: RECORD_TABS_SECTION_KEY,
      title: t('settings.record-tabs.title'),
      description: t('settings.record-tabs.description'),
      icon: 'fileList',
      properties: properties.sort((a, b) => compareText(a.label, b.label)),
    };
  }, [contributions, dynamicScreens, declared, label, compareText, t]);
};
