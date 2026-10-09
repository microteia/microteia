import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLookups } from '../../../stores/useLookups';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useSettings } from '../../../stores/useSettings';
import { useReferenceOptions } from '../../hooks/useReferenceOptions';
import { resolveColor } from '../../../shared/styles/colorUtils';
import { resolveSettingsOptionsScreen } from '../../../domain/usecases/plugins/settingsOptionsScreen';
import { screenDataCollection, screenReadPermission } from '../../../domain/services/screenDataCollection';
import { resolveSetting, type SettingsProperty } from '../../../domain/schema/settings';
import { useLabel } from '../i18n/useT';
import { useSettingsSections } from './useSettingsCatalog';

/**
 * `ready` — as opções estão na mão. `forbidden` — vêm de uma tela que quem olha não pode ler: a
 * lista vazia diria "não há opções", e o que há é falta de permissão. `unavailable` — a coleção não
 * existe neste escritório (a extensão dona não está instalada).
 */
export type SettingOptionsStatus = 'ready' | 'forbidden' | 'unavailable';

export interface SettingOption {
  value: string;
  label: string;
  color?: string;
  meta?: string;
}

export interface SettingOptions {
  status: SettingOptionsStatus;
  options: SettingOption[];
  /** O nome da tela de onde vêm os registros, já traduzido. Vazio quando a fonte não é uma tela. */
  sourceTitle: string;
}

const EMPTY_PACKAGE_SCREENS: never[] = [];

/**
 * As opções de um `select` de Configurações, de onde quer que venham: a lista fechada do pacote, uma
 * lista de opções do escritório (com a cor dela) ou os registros de uma tela (pelo campo-título).
 *
 * O `value` de cada opção é EXATAMENTE o que o campo equivalente grava no registro — a chave da opção
 * ou o id do registro —, e é isso que deixa a view comparar a configuração com o dado por igualdade.
 *
 * Uma lista de opções é vocabulário, não dado: todo membro a lê (`isDeclaredVocabulary` nas regras),
 * e por isso só a fonte `entity` pergunta pela permissão.
 */
export const useSettingOptions = (property: SettingsProperty, pluginId?: string): SettingOptions => {
  const theme = useTheme();
  const label = useLabel();
  const { getOptions, availableLookups, loading: lookupsLoading } = useLookups();
  const { dynamicScreens } = useScreenDefinitions();
  const { installedOf } = useInstalledExtensions();
  const { can } = useAuthorization();
  const referenceOptions = useReferenceOptions();
  const source = property.optionsFrom;

  const packageScreens = useMemo(
    () => (pluginId ? installedOf(pluginId)?.package.screens ?? EMPTY_PACKAGE_SCREENS : EMPTY_PACKAGE_SCREENS),
    [pluginId, installedOf],
  );

  return useMemo<SettingOptions>(() => {
    if (!source) {
      return {
        status: 'ready',
        options: (property.options ?? []).map((option) => ({ value: option.value, label: label(option.label) })),
        sourceTitle: '',
      };
    }

    if (source.kind === 'lookup') {
      const known = lookupsLoading || availableLookups.some((lookup) => lookup.collection === source.collection);
      return {
        status: known ? 'ready' : 'unavailable',
        options: getOptions(source.collection).map((option) => ({
          value: option.key,
          label: label(option.label),
          color: resolveColor(option.color, theme, false),
        })),
        sourceTitle: '',
      };
    }

    const screen = resolveSettingsOptionsScreen(source.collection, packageScreens, dynamicScreens);
    if (!screen) return { status: 'unavailable', options: [], sourceTitle: '' };
    const sourceTitle = label(screen.titlePlural);
    if (!can(screenReadPermission(screen))) return { status: 'forbidden', options: [], sourceTitle };
    return { status: 'ready', options: referenceOptions[screenDataCollection(screen)] ?? [], sourceTitle };
  }, [
    source, property.options, label, lookupsLoading, availableLookups, getOptions, theme,
    packageScreens, dynamicScreens, can, referenceOptions,
  ]);
};

/** Um valor escolhido, com o que a view precisa para mostrá-lo sem reler a coleção. */
export interface SettingChoice {
  value: string;
  label: string;
  color?: string;
  /** O valor está gravado, mas a opção ou o registro não existe mais. */
  missing: boolean;
}

const NO_PROPERTY: SettingsProperty = { key: '', label: '', type: 'select', default: undefined, scopes: [] };

const findDeclaration = (
  sections: ReturnType<typeof useSettingsSections>,
  key: string,
): { property: SettingsProperty; pluginId?: string } | null => {
  for (const section of sections) {
    const property = section.properties.find((candidate) => candidate.key === key);
    if (property) return { property, pluginId: section.pluginId };
  }
  return null;
};

const chosenValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item !== '');
  return typeof value === 'string' && value !== '' ? [value] : [];
};

/**
 * O valor EM VIGOR de um `select`, item a item, com rótulo e cor — para o título de um cartão dizer
 * "Em Andamento, Suspenso" com as cores da lista, sem que a extensão releia a coleção.
 *
 * `missing` só é afirmado quando as opções estão na mão. Sem permissão de leitura, ou com a coleção
 * ausente, não há como saber, e o valor sai como está — dizer "não existe" ali seria inventar.
 */
export const useSettingChoices = (key: string): SettingChoice[] => {
  const sections = useSettingsSections();
  const { values } = useSettings();

  const found = useMemo(() => findDeclaration(sections, key), [sections, key]);

  const { status, options } = useSettingOptions(found?.property ?? NO_PROPERTY, found?.pluginId);

  return useMemo(() => {
    if (!found || found.property.type !== 'select') return [];
    const byValue = new Map(options.map((option) => [option.value, option]));
    return chosenValues(resolveSetting(found.property, values).value).map((value) => {
      const option = byValue.get(value);
      if (option) return { value, label: option.label, color: option.color, missing: false };
      return { value, label: value, missing: status === 'ready' };
    });
  }, [found, options, status, values]);
};
