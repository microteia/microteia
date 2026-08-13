/**
 * As CONFIGURAÇÕES do escritório — o documento que a tela de Configurações grava
 * (`tenants/{tenantId}/settings/tenant`), com uma chave por propriedade declarada por extensão.
 *
 * O servidor lê valor, nunca declaração: quem diz que `push.allowedSenders` existe, é uma lista de
 * textos e tem que padrão é o manifest da extensão, no cliente. Aqui é só o que está gravado.
 */
export interface ITenantSettingsRepository {
  getTenantValues(tenantId: string): Promise<Record<string, unknown>>;
}
