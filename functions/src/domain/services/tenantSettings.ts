import { DEFAULT_LOCALE } from '../schema/i18n/localeNegotiation';
import { ARTIFACT_PREFIX_SETTING, isArtifactPrefix } from '../schema/plugin/artifactPrefix';

/**
 * O formato do documento de configurações do escritório (`tenants/{tid}/settings/tenant`), visto do
 * servidor: a raiz é do DOCUMENTO (`scope`, `updatedAt`, `updatedBy`) e as chaves declaradas pelas
 * extensões ficam dentro de `values`.
 *
 * Existe como função pura porque foi exatamente aqui que a leitura errou: ler a raiz devolve um
 * mapa em que nenhuma chave declarada existe — e o efeito não é erro, é uma lista vazia que parece
 * configuração legítima. Quem grava é o `FirebaseSettingsRepository` do cliente; as duas pontas
 * precisam concordar sobre este campo.
 */
export const SETTINGS_VALUES_FIELD = 'values';

export const settingsValuesOf = (data: unknown): Record<string, unknown> => {
  if (typeof data !== 'object' || data === null) return {};
  const values = (data as Record<string, unknown>)[SETTINGS_VALUES_FIELD];
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return {};
  return values as Record<string, unknown>;
};

const LOCALE_SETTING = 'i18n.locale';

/**
 * O idioma de uma pessoa sobre valores já lidos: `user > tenant > default`, a ordem do cliente. Existe
 * separada da leitura porque quem resolve o idioma de VÁRIOS destinatários lê os documentos em lote.
 */
/** O idioma ESCOLHIDO — pela pessoa ou pelo escritório —, ou `null` quando ninguém escolheu. */
export const configuredLocale = (
  own: Record<string, unknown>,
  office: Record<string, unknown>,
): string | null => {
  for (const values of [own, office]) {
    const chosen = values[LOCALE_SETTING];
    if (typeof chosen === 'string' && chosen.trim() !== '') return chosen;
  }
  return null;
};

export const preferredLocale = (
  own: Record<string, unknown>,
  office: Record<string, unknown>,
): string => {
  for (const values of [own, office]) {
    const chosen = values[LOCALE_SETTING];
    if (typeof chosen === 'string' && chosen.trim() !== '') return chosen;
  }
  return DEFAULT_LOCALE;
};

/** O prefixo do escritório sobre valores já lidos de `settings/tenant`; `null` quando não há um válido. */
export const officePrefixOf = (office: Record<string, unknown>): string | null => {
  const prefix = office[ARTIFACT_PREFIX_SETTING];
  return isArtifactPrefix(prefix) ? prefix : null;
};
