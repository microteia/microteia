import { useMemo } from 'react';
import { useContributions, useKernel } from '../../../stores/useKernel';
import { evaluateExtensionView } from '../extensions/evaluateExtensionView';
import { isExtensionViewRef } from '../../../domain/usecases/plugins/extensionViewRef';
import {
  useExtensionSettingsSections,
  useExtensionSurfaceWidgets,
  type ExtensionSettingsSection,
  type ExtensionSurfaceWidget,
} from '../extensions/extensionServices';
import { UI_SETTINGS_POINT, UI_WIDGET_POINT, type UiWidgetMetadata } from '../uiExtensionPoints';
import type { SettingsProperty, SettingsSection } from '../../../domain/schema/settings';
import { isWidgetSpec, type WidgetSpec } from '../widget/widgetSpec';

/**
 * O catálogo do que existe para configurar e para renderizar. Duas origens chegam aqui e saem
 * iguais:
 *
 * 1. **Contribuição de manifest** (`ui.settings` / `ui.widget`) — declarativa, viaja no pacote, é o
 *    único caminho de quem não pode entregar código;
 * 2. **Registro no `startup`** — código de extensão confiável, que entrega o componente pronto.
 *
 * Quem consome não distingue as duas, e é isso que faz o Dashboard e a tela de Configurações não
 * conhecerem nenhuma extensão em particular.
 */

export interface SurfaceWidgetDescriptor extends UiWidgetMetadata {
  pluginId: string;
  component?: React.ComponentType;
  spec?: WidgetSpec;
}

const asSection = (metadata: Record<string, unknown>): SettingsSection | null => {
  const key = metadata.key;
  const title = metadata.title;
  const properties = metadata.properties;
  if (typeof key !== 'string' || typeof title !== 'string' || !Array.isArray(properties)) return null;
  return {
    key,
    title,
    description: typeof metadata.description === 'string' ? metadata.description : undefined,
    icon: typeof metadata.icon === 'string' ? metadata.icon : undefined,
    order: typeof metadata.order === 'number' ? metadata.order : undefined,
    properties: properties.filter((property): property is SettingsProperty => {
      const candidate = property as Partial<SettingsProperty>;
      return typeof candidate?.key === 'string' && typeof candidate?.type === 'string' && Array.isArray(candidate?.scopes);
    }),
  };
};

const asWidgetMetadata = (metadata: Record<string, unknown>): UiWidgetMetadata | null => {
  const { surface, key, title } = metadata;
  if (typeof surface !== 'string' || typeof key !== 'string' || typeof title !== 'string') return null;
  return {
    surface,
    key,
    title,
    description: typeof metadata.description === 'string' ? metadata.description : undefined,
    icon: typeof metadata.icon === 'string' ? metadata.icon : undefined,
    defaultEnabled: typeof metadata.defaultEnabled === 'boolean' ? metadata.defaultEnabled : undefined,
    defaultSpan: typeof metadata.defaultSpan === 'number' ? metadata.defaultSpan : undefined,
    order: typeof metadata.order === 'number' ? metadata.order : undefined,
  };
};

const byOrderThenTitle = (a: SettingsSection, b: SettingsSection): number =>
  (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'pt-BR');

/** As seções declaradas, deduplicadas por chave — a registrada em código vence a declarativa. */
export const useSettingsSections = (): ExtensionSettingsSection[] => {
  const contributions = useContributions(UI_SETTINGS_POINT);
  const registered = useExtensionSettingsSections();

  return useMemo(() => {
    const byKey = new Map<string, ExtensionSettingsSection>();
    for (const contribution of contributions) {
      const section = asSection(contribution.metadata);
      if (section) byKey.set(section.key, section);
    }
    for (const section of registered) byKey.set(section.key, section);
    return Array.from(byKey.values()).sort(byOrderThenTitle);
  }, [contributions, registered]);
};

/** Os widgets de uma superfície, na ordem declarada — a configuração reordena depois. */
export const useSurfaceWidgets = (surface: string): SurfaceWidgetDescriptor[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_WIDGET_POINT);
  const registered = useExtensionSurfaceWidgets();

  return useMemo(() => {
    const byKey = new Map<string, SurfaceWidgetDescriptor>();

    for (const contribution of contributions) {
      const metadata = asWidgetMetadata(contribution.metadata);
      if (!metadata || metadata.surface !== surface) continue;

      if (contribution.impl?.kind === 'widget') {
        const spec = contribution.impl.spec as unknown;
        if (!isWidgetSpec(spec)) continue;
        byKey.set(metadata.key, { ...metadata, pluginId: contribution.pluginId, spec });
        continue;
      }

      if (contribution.impl?.kind === 'code') {
        const impl = host.implementations.resolve<unknown>(contribution.pluginId, contribution.impl.key);
        const component = (isExtensionViewRef(impl)
          ? evaluateExtensionView(`${impl.pluginId}::${impl.viewKey}`, impl.source)
          : impl) as React.ComponentType | undefined;
        if (!component) continue;
        byKey.set(metadata.key, { ...metadata, pluginId: contribution.pluginId, component });
      }
    }

    for (const widget of registered as ExtensionSurfaceWidget[]) {
      if (widget.surface !== surface) continue;
      byKey.set(widget.key, { ...widget, pluginId: widget.key, component: widget.component });
    }

    return Array.from(byKey.values()).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'pt-BR'),
    );
  }, [contributions, registered, surface, host]);
};
