/** O que a tela de consentimento mostra sobre quem está pedindo autorização. */
export interface AgentAuthRequestView {
  clientName: string;
  clientId: string;
  /** O host para onde a autorização volta. A spec manda MOSTRÁ-LO a quem está autorizando. */
  redirectHost: string;
  /**
   * O destino é só a máquina de quem está autorizando.
   *
   * Vale um aviso à parte, e a razão é concreta: qualquer processo local pode abrir uma porta e
   * dizer que é o cliente. Quem autoriza precisa saber que a garantia ali é menor.
   */
  loopbackOnly: boolean;
}

export interface AgentConsentInput {
  requestId: string;
  tenantId: string;
  /** O TETO consentido — ids do catálogo de permissões do escritório. Nunca o curinga. */
  permissions: string[];
  expiresInDays: number | null;
}

/**
 * Os pedidos de autorização de OAuth em curso.
 *
 * TUDO por callable, nos dois sentidos: a coleção é fechada para todo cliente, porque quem escreve
 * nela escolhe qual código de autorização vale. A tela nunca vê o hash do código — ela recebe o que
 * precisa para perguntar à pessoa, e devolve a resposta dela.
 */
export interface IAgentAuthRequestRepository {
  get(requestId: string): Promise<AgentAuthRequestView>;
  /** Devolve para onde o navegador tem de voltar. O código viaja só nessa URL. */
  consent(input: AgentConsentInput): Promise<string>;
}
