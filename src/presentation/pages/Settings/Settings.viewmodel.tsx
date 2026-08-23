import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useSettings } from '../../../stores/useSettings';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_SETTINGS_MANAGE } from '../../../domain/schema/access';
import { useNotification } from '../../../stores/useNotification';
import { useSettingsSections } from '../../shared/settings/useSettingsCatalog';
import { visibleSettingsSections } from '../../shared/resolveUiContributions';
import type { ExtensionSettingsSection } from '../../shared/extensions/extensionServices';
import { useT } from '../../shared/i18n/useT';
import type { SettingsJsonParse, SettingsValueIssue } from '../../../domain/schema/settings';
import {
  matchesSettingsQuery,
  parseSettingsJson,
  propertyAcceptsScope,
  resolveSetting,
  settingsToJson,
  type SettingsProperty,
  type SettingsScope,
} from '../../../domain/schema/settings';

export type SettingsMode = 'visual' | 'json';

export interface SettingsRow {
  sectionKey: string;
  sectionTitle: string;
  property: SettingsProperty;
  /** O valor que o editor mostra: o gravado neste escopo, ou o herdado quando não há. */
  value: unknown;
  /** De onde vem o valor em vigor — `null` é o padrão declarado. */
  originScope: SettingsScope | null;
  /** Há valor gravado NESTE escopo (o que habilita "Restaurar padrão"). */
  isSetHere: boolean;
  isEditable: boolean;
  /** O escritório está definido, mas a preferência do usuário é que vale. */
  isOverriddenByUser: boolean;
}

export interface SettingsViewModel {
  isLoading: boolean;
  sections: ExtensionSettingsSection[];
  activeSectionKey: string;
  selectSection: (key: string) => void;
  query: string;
  setQuery: (value: string) => void;
  scope: SettingsScope;
  setScope: (scope: SettingsScope) => void;
  canEditTenant: boolean;
  mode: SettingsMode;
  setMode: (mode: SettingsMode) => void;
  rows: SettingsRow[];
  /** A seção em foco quando ela traz editor próprio, em vez das propriedades declaradas. */
  activeEditor: React.ComponentType | null;
  changeValue: (property: SettingsProperty, value: unknown) => void;
  resetValue: (property: SettingsProperty) => void;
  jsonText: string;
  changeJson: (text: string) => void;
  jsonSyntaxError: SettingsValueIssue | null;
  jsonIssues: SettingsJsonParse['errors'];
  isJsonDirty: boolean;
  canSaveJson: boolean;
  saveJson: () => void;
  discardJson: () => void;
}

export const useSettingsViewModel = (): SettingsViewModel => {
  const t = useT('core.settings');
  const { values, isLoading, setValue, clearValue, replaceScope } = useSettings();
  const { can, canAny } = useAuthorization();
  const canEditTenant = can(PERMISSION_SETTINGS_MANAGE);
  const { notify } = useNotification();
  const catalog = useSettingsSections();

  /**
   * O que esta pessoa VÊ. A validação do modo JSON continua sobre o catálogo INTEIRO: ela existe para
   * explicar o que já está gravado, e um valor deixar de ser validado porque quem olha não vê a seção
   * seria mentira sobre o dado, não discrição sobre a tela.
   */
  const sections = useMemo(() => visibleSettingsSections(catalog, canAny), [catalog, canAny]);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SettingsScope>('user');
  const [mode, setMode] = useState<SettingsMode>('visual');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ scope: SettingsScope; text: string } | null>(null);

  const activeSectionKey = useMemo(() => {
    if (selectedKey && sections.some((section) => section.key === selectedKey)) return selectedKey;
    return sections[0]?.key ?? '';
  }, [selectedKey, sections]);

  const isSearching = query.trim() !== '';

  const rows = useMemo<SettingsRow[]>(() => {
    const scoped = isSearching
      ? sections
      : sections.filter((section) => section.key === activeSectionKey);

    return scoped.flatMap((section) =>
      section.properties
        .filter((property) => matchesSettingsQuery(section, property, query))
        .map((property) => {
          const resolved = resolveSetting(property, values);
          const stored = values[scope][property.key];
          return {
            sectionKey: section.key,
            sectionTitle: section.title,
            property,
            value: stored === undefined ? resolved.value : stored,
            originScope: resolved.scope,
            isSetHere: stored !== undefined,
            isEditable: propertyAcceptsScope(property, scope) && (scope === 'tenant' ? canEditTenant : true),
            isOverriddenByUser: scope === 'tenant' && values.user[property.key] !== undefined,
          };
        }),
    );
  }, [sections, activeSectionKey, isSearching, query, values, scope, canEditTenant]);

  const activeEditor = useMemo(() => {
    if (isSearching) return null;
    const section = sections.find((item) => item.key === activeSectionKey);
    return section?.editor ?? null;
  }, [sections, activeSectionKey, isSearching]);

  const changeValue = useCallback((property: SettingsProperty, value: unknown) => {
    void setValue(scope, property.key, value).catch(() =>
      notify(t('settings.save-failed'), 'error'),
    );
  }, [setValue, scope, notify, t]);

  const resetValue = useCallback((property: SettingsProperty) => {
    void clearValue(scope, property.key).catch(() =>
      notify(t('settings.reset-failed'), 'error'),
    );
  }, [clearValue, scope, notify, t]);

  const storedJson = useMemo(() => settingsToJson(values[scope]), [values, scope]);
  const jsonText = draft?.scope === scope ? draft.text : storedJson;
  const isJsonDirty = jsonText !== storedJson;

  const parsed = useMemo(
    () => parseSettingsJson(catalog, jsonText, scope),
    [catalog, jsonText, scope],
  );

  const changeJson = useCallback((text: string) => {
    setDraft({ scope, text });
  }, [scope]);

  const discardJson = useCallback(() => setDraft(null), []);

  const canSaveJson = isJsonDirty && parsed.syntaxError === null && parsed.errors.length === 0;

  const saveJson = useCallback(() => {
    if (!canSaveJson) return;
    void replaceScope(scope, parsed.values)
      .then(() => {
        setDraft(null);
        notify(t('settings.saved'), 'success');
      })
      .catch(() => notify(t('settings.save-all-failed'), 'error'));
  }, [canSaveJson, replaceScope, scope, parsed.values, notify, t]);

  const selectSection = useCallback((key: string) => {
    setSelectedKey(key);
    setQuery('');
  }, []);

  const changeScope = useCallback((next: SettingsScope) => {
    setScope(next);
    setDraft(null);
  }, []);

  return {
    isLoading,
    sections,
    activeSectionKey,
    selectSection,
    query,
    setQuery,
    scope,
    setScope: changeScope,
    canEditTenant,
    mode,
    setMode,
    rows,
    activeEditor,
    changeValue,
    resetValue,
    jsonText,
    changeJson,
    jsonSyntaxError: parsed.syntaxError,
    jsonIssues: parsed.errors,
    isJsonDirty,
    canSaveJson,
    saveJson,
    discardJson,
  };
};
