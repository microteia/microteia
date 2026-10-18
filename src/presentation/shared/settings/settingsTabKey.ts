import type { SettingsScope } from '../../../domain/schema/settings';

/**
 * A aba de Configurações aberta JÁ numa seção e num escopo: `settings:<escopo>:<seção>`. É o que deixa
 * outra tela levar a pessoa direto ao ajuste de que ela precisa — o prefixo, antes de criar uma tela —
 * em vez de dizer "vá a Configurações e procure".
 */
export const SETTINGS_TAB_PREFIX = 'settings:';

export const settingsTabKey = (scope: SettingsScope, sectionKey: string): string =>
  `${SETTINGS_TAB_PREFIX}${scope}:${sectionKey}`;

export interface SettingsTabTarget {
  scope: SettingsScope;
  sectionKey: string;
}

/** O destino de uma aba `settings:…`; `null` para a aba comum ou para uma chave que não diz nada. */
export const settingsTabTarget = (tabKey: string | undefined): SettingsTabTarget | null => {
  if (!tabKey?.startsWith(SETTINGS_TAB_PREFIX)) return null;
  const [scope, ...rest] = tabKey.slice(SETTINGS_TAB_PREFIX.length).split(':');
  const sectionKey = rest.join(':');
  if ((scope !== 'tenant' && scope !== 'user') || sectionKey === '') return null;
  return { scope, sectionKey };
};
