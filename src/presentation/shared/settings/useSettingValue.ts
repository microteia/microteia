import { useCallback, useMemo } from 'react';
import { useSettings } from '../../../stores/useSettings';
import {
  findSettingsProperty,
  resolveContributionLayout,
  resolveSetting,
  resolveWidgetLayout,
  type ContributionLayoutEntry,
  type SettingsProperty,
  type SettingsScope,
  type SettingsSection,
  type WidgetLayoutEntry,
} from '../../../domain/schema/settings';
import { UI_TAB_POINT } from '../../../domain/schema/ui/uiExtensionPoints';
import { useSettingsSections, useSurfaceTabs, useSurfaceWidgets } from './useSettingsCatalog';

/**
 * A propriedade que ordena os widgets de uma superfície. Quem hospeda a superfície normalmente a
 * declara (é o que dá nome e descrição à seção); quando não declara, esta é a propriedade implícita
 * — a superfície continua configurável, e a chave segue a mesma convenção.
 */
export const surfaceLayoutProperty = (
  sections: SettingsSection[],
  surface: string,
): SettingsProperty => {
  for (const section of sections) {
    const declared = section.properties.find(
      (property) => property.type === 'widgets' && property.surface === surface,
    );
    if (declared) return declared;
  }
  return {
    key: `${surface}.widgets`,
    label: '@core.ui/settings.widgets',
    type: 'widgets',
    default: [],
    scopes: ['tenant', 'user'],
    surface,
  };
};

/**
 * A propriedade que liga/desliga e ordena as abas de uma superfície. Mesmo desenho da de widgets, e
 * pelo mesmo motivo: quem hospeda a faixa normalmente a declara, e quando não declara a superfície
 * continua configurável por esta propriedade implícita.
 */
export const surfaceTabsProperty = (
  sections: SettingsSection[],
  surface: string,
): SettingsProperty => {
  for (const section of sections) {
    const declared = section.properties.find(
      (property) => property.type === 'contributions'
        && property.point === UI_TAB_POINT
        && property.surface === surface,
    );
    if (declared) return declared;
  }
  return {
    key: `${surface}.tabs`,
    label: '@core.ui/settings.tabs',
    type: 'contributions',
    default: [],
    scopes: ['tenant', 'user'],
    point: UI_TAB_POINT,
    surface,
  };
};

/** O valor em vigor de uma propriedade e de onde ele veio (padrão, escritório ou usuário). */
export const useResolvedSetting = (property: SettingsProperty): {
  value: unknown;
  scope: SettingsScope | null;
} => {
  const { values } = useSettings();
  return useMemo(() => resolveSetting(property, values), [property, values]);
};

/** O valor em vigor pela CHAVE, para quem só conhece o nome da configuração. */
export const useSettingValue = (key: string): unknown => {
  const sections = useSettingsSections();
  const { values } = useSettings();
  return useMemo(() => {
    const property = findSettingsProperty(sections, key);
    if (!property) return values.user[key] ?? values.tenant[key];
    return resolveSetting(property, values).value;
  }, [sections, values, key]);
};

export interface SurfaceLayout {
  entries: WidgetLayoutEntry[];
  property: SettingsProperty;
  save: (entries: WidgetLayoutEntry[], scope: SettingsScope) => Promise<void>;
}

/**
 * A lista de widgets de uma superfície já conciliada com o que está REGISTRADO: o que a extensão
 * instalou depois entra no fim, o que sumiu não deixa buraco, e a ordem escolhida é respeitada.
 */
export const useSurfaceLayout = (surface: string): SurfaceLayout => {
  const sections = useSettingsSections();
  const widgets = useSurfaceWidgets(surface);
  const { values, setValue } = useSettings();

  const property = useMemo(() => surfaceLayoutProperty(sections, surface), [sections, surface]);

  const entries = useMemo(() => {
    const stored = resolveSetting(property, values).value;
    return resolveWidgetLayout(stored, widgets);
  }, [property, values, widgets]);

  const save = useCallback(
    (next: WidgetLayoutEntry[], scope: SettingsScope) => setValue(scope, property.key, next),
    [setValue, property.key],
  );

  return { entries, property, save };
};

export interface SurfaceTabLayout {
  entries: ContributionLayoutEntry[];
  property: SettingsProperty;
}

/** O mesmo conciliar da superfície de widgets, para a faixa de abas de uma superfície. */
export const useSurfaceTabLayout = (surface: string): SurfaceTabLayout => {
  const sections = useSettingsSections();
  const tabs = useSurfaceTabs(surface);
  const { values } = useSettings();

  const property = useMemo(() => surfaceTabsProperty(sections, surface), [sections, surface]);

  const entries = useMemo(() => {
    const stored = resolveSetting(property, values).value;
    return resolveContributionLayout(stored, tabs);
  }, [property, values, tabs]);

  return { entries, property };
};
