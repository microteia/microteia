import type { SettingsScope, SettingsValues } from '../schema/settings';

/**
 * Persistência dos valores de configuração de um escritório, em `tenants/{tenantId}/settings`.
 *
 * São dois documentos por usuário conectado, e não uma coleção de itens: `tenant` (o padrão do
 * escritório) e `user_{uid}` (a preferência pessoal). Documento inteiro por escopo, porque é assim
 * que a tela edita em JSON — o que se grava é exatamente o que se lê.
 */
export interface ISettingsRepository {
  subscribe(
    tenantId: string,
    userId: string,
    onChange: (scope: SettingsScope, values: SettingsValues) => void,
  ): () => void;
  save(tenantId: string, userId: string, scope: SettingsScope, values: SettingsValues): Promise<void>;
}
