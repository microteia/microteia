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
import {
  UI_SETTINGS_POINT,
  UI_TAB_POINT,
  UI_WIDGET_POINT,
  type UiTabMetadata,
  type UiWidgetMetadata,
} from '../uiExtensionPoints';
import type { SettingsProperty, SettingsSection } from '../../../domain/schema/settings';
import { isWidgetSpec, type WidgetSpec } from '../widget/widgetSpec';
import { useLabel, useLocaleFormat } from '../i18n/useT';

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

export interface SurfaceTabDescriptor extends UiTabMetadata {
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

const asTabMetadata = (metadata: Record<string, unknown>): UiTabMetadata | null => {
  const { surface, key, title } = metadata;
  if (typeof surface !== 'string' || typeof key !== 'string' || typeof title !== 'string') return null;
  return {
    surface,
    key,
    title,
    description: typeof metadata.description === 'string' ? metadata.description : undefined,
    icon: typeof metadata.icon === 'string' ? metadata.icon : undefined,
    defaultEnabled: typeof metadata.defaultEnabled === 'boolean' ? metadata.defaultEnabled : undefined,
    order: typeof metadata.order === 'number' ? metadata.order : undefined,
    requiredRole: typeof metadata.requiredRole === 'string'
      ? (metadata.requiredRole as UiTabMetadata['requiredRole'])
      : undefined,
    requiresTenantAdmin: metadata.requiresTenantAdmin === true,
  };
};

/**
 * A seção com título, rótulos e descrições já RESOLVIDOS. Traduzir aqui — na montagem do catálogo,
 * e não em cada `{section.title}` da View — tem uma consequência que a View não teria: a busca da
 * tela (`matchesSettingsQuery`) passa a casar com o texto que a pessoa está lendo. Traduzido na
 * View, procurar por "idioma" não acharia a seção cujo rótulo diz "Idioma".
 */
const translateSection = (
  section: ExtensionSettingsSection,
  label: (value: string | null | undefined) => string,
): ExtensionSettingsSection => ({
  ...section,
  title: label(section.title),
  description: section.description === undefined ? undefined : label(section.description),
  properties: section.properties.map((property) => ({
    ...property,
    label: label(property.label),
    description: property.description === undefined ? undefined : label(property.description),
    options: property.options?.map((option) => ({ ...option, label: label(option.label) })),
  })),
});

const byOrderThenTitle = (
  compare: (a: string, b: string) => number,
) => (a: SettingsSection, b: SettingsSection): number =>
  (a.order ?? 0) - (b.order ?? 0) || compare(a.title, b.title);

/** As seções declaradas, deduplicadas por chave — a registrada em código vence a declarativa. */
export const useSettingsSections = (): ExtensionSettingsSection[] => {
  const contributions = useContributions(UI_SETTINGS_POINT);
  const registered = useExtensionSettingsSections();
  const label = useLabel();
  const { compareText } = useLocaleFormat();

  return useMemo(() => {
    const byKey = new Map<string, ExtensionSettingsSection>();
    for (const contribution of contributions) {
      const section = asSection(contribution.metadata);
      if (section) byKey.set(section.key, section);
    }
    for (const section of registered) byKey.set(section.key, section);
    return Array.from(byKey.values())
      .map((section) => translateSection(section, label))
      .sort(byOrderThenTitle(compareText));
  }, [contributions, registered, label, compareText]);
};

/** Os widgets de uma superfície, na ordem declarada — a configuração reordena depois. */
export const useSurfaceWidgets = (surface: string): SurfaceWidgetDescriptor[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_WIDGET_POINT);
  const registered = useExtensionSurfaceWidgets();
  const label = useLabel();
  const { compareText } = useLocaleFormat();

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

    return Array.from(byKey.values())
      .map((widget) => ({
        ...widget,
        title: label(widget.title),
        description: widget.description === undefined ? undefined : label(widget.description),
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || compareText(a.title, b.title));
  }, [contributions, registered, surface, host, label, compareText]);
};

/**
 * As abas de uma superfície, na ordem declarada — a configuração reordena depois, pelo mesmo
 * caminho dos widgets. O título já vem resolvido: quem hospeda a faixa de abas não sabe traduzir.
 */
export const useSurfaceTabs = (surface: string): SurfaceTabDescriptor[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_TAB_POINT);
  const label = useLabel();
  const { compareText } = useLocaleFormat();

  return useMemo(() => {
    const byKey = new Map<string, SurfaceTabDescriptor>();

    for (const contribution of contributions) {
      const metadata = asTabMetadata(contribution.metadata);
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

    return Array.from(byKey.values())
      .map((tab) => ({
        ...tab,
        title: label(tab.title),
        description: tab.description === undefined ? undefined : label(tab.description),
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || compareText(a.title, b.title));
  }, [contributions, surface, host, label, compareText]);
};
