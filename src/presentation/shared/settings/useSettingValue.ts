import { useCallback, useMemo } from 'react';
import { useOptionalSettings, useSettings } from '../../../stores/useSettings';
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
import { UI_MENU_POINT, UI_SLOT_POINT, UI_TAB_POINT } from '../../../domain/schema/ui/uiExtensionPoints';
import {
  useSettingsSections,
  useSurfaceMenuItems,
  useSurfaceSlots,
  useSurfaceTabs,
  useSurfaceWidgets,
} from './useSettingsCatalog';

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
const contributionsProperty = (
  sections: SettingsSection[],
  point: string,
  surface: string,
  key: string,
  label: string,
): SettingsProperty => {
  for (const section of sections) {
    const declared = section.properties.find(
      (property) => property.type === 'contributions'
        && property.point === point
        && property.surface === surface,
    );
    if (declared) return declared;
  }
  return {
    key,
    label,
    type: 'contributions',
    default: [],
    scopes: ['tenant', 'user'],
    point,
    surface,
  };
};

export const surfaceTabsProperty = (
  sections: SettingsSection[],
  surface: string,
): SettingsProperty =>
  contributionsProperty(sections, UI_TAB_POINT, surface, `${surface}.tabs`, '@core.ui/settings.tabs');

/**
 * A propriedade que liga/desliga e ordena os TRECHOS de uma região do shell. Mesma mecânica das abas
 * — e é o que faz a instalação decidir o que aparece no alto da própria tela sem commit no núcleo.
 */
export const surfaceSlotsProperty = (
  sections: SettingsSection[],
  surface: string,
): SettingsProperty =>
  contributionsProperty(sections, UI_SLOT_POINT, surface, `${surface}.slots`, '@core.ui/settings.slots');

/** A propriedade que liga/desliga e ordena os ITENS de um menu. */
export const surfaceMenuProperty = (
  sections: SettingsSection[],
  surface: string,
): SettingsProperty =>
  contributionsProperty(sections, UI_MENU_POINT, surface, `${surface}.items`, '@core.ui/settings.menu');

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

export interface SurfaceContributionLayout {
  entries: ContributionLayoutEntry[];
  property: SettingsProperty;
}

/**
 * O mesmo conciliar da faixa de abas, para os trechos de uma região do shell — e o único que tolera
 * NÃO haver configuração.
 *
 * A tolerância não é conveniência: a tela de entrada hospeda regiões, e ali não existe documento de
 * configuração a ler porque não existe escritório. Sem configuração vale o que foi DECLARADO, que é o
 * padrão de toda propriedade — a ausência é o estado inicial de qualquer instalação, não um erro.
 */
export const useSurfaceSlotLayout = (surface: string): SurfaceContributionLayout => {
  const sections = useSettingsSections();
  const slots = useSurfaceSlots(surface);
  const settings = useOptionalSettings();

  const property = useMemo(() => surfaceSlotsProperty(sections, surface), [sections, surface]);

  const entries = useMemo(
    () => resolveContributionLayout(
      settings ? resolveSetting(property, settings.values).value : undefined,
      slots,
    ),
    [property, settings, slots],
  );

  return { entries, property };
};

/** O mesmo conciliar, para os itens de um menu. */
export const useSurfaceMenuLayout = (surface: string): SurfaceContributionLayout => {
  const sections = useSettingsSections();
  const items = useSurfaceMenuItems(surface);
  const { values } = useSettings();

  const property = useMemo(() => surfaceMenuProperty(sections, surface), [sections, surface]);

  const entries = useMemo(
    () => resolveContributionLayout(resolveSetting(property, values).value, items),
    [property, values, items],
  );

  return { entries, property };
};
