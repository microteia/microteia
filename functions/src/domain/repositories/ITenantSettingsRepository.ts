/**
 * As CONFIGURAÇÕES do escritório — o documento que a tela de Configurações grava
 * (`tenants/{tenantId}/settings/tenant`), com uma chave por propriedade declarada por extensão.
 *
 * O servidor lê valor, nunca declaração: quem diz que `push.allowedSenders` existe, é uma lista de
 * textos e tem que padrão é o manifest da extensão, no cliente. Aqui é só o que está gravado.
 */
export interface ITenantSettingsRepository {
  getTenantValues(tenantId: string): Promise<Record<string, unknown>>;
  /**
   * As configurações PESSOAIS de um membro (`settings/user_{uid}`), que ficam ACIMA das do
   * escritório na resolução — a mesma ordem `user > tenant > default` do cliente.
   *
   * Ela existe porque o gateway de agente resolve texto, e o idioma em que ele resolve é o de quem
   * emitiu o acesso. Ler só o do escritório faria o agente de um membro responder no idioma de
   * outro.
   */
  getUserValues(tenantId: string, userId: string): Promise<Record<string, unknown>>;
}
