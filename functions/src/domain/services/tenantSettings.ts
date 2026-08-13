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
