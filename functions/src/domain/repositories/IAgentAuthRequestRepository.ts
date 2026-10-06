import type { AgentAuthRequest } from '../schema/agent/agentOAuth';

/** O que o `/authorize` sabe antes de qualquer pessoa ter entrado. */
export interface NewAgentAuthRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string[];
  resource: string | null;
  expiresAt: Date;
}

/** O que o consentimento acrescenta ao pedido, transformando-o num código. */
export interface ConsentedAgentAuthRequest {
  tenantId: string;
  userId: string;
  grantId: string;
  codeHash: string;
  expiresAt: Date;
}

/**
 * Os pedidos de autorização pendentes.
 *
 * Coleção de RAIZ, não subcoleção de escritório: quando o pedido nasce ainda não há escritório
 * escolhido — escolhê-lo é parte do consentimento. Nenhum cliente lê ou escreve esta coleção; o
 * navegador chega aos dados dela por callable, filtrados, e nunca ao `codeHash`.
 */
export interface IAgentAuthRequestRepository {
  create(request: NewAgentAuthRequest): Promise<string>;
  getById(requestId: string): Promise<AgentAuthRequest | null>;
  /** `false` quando o pedido já virou código — consentir duas vezes emitiria dois acessos. */
  consent(requestId: string, consented: ConsentedAgentAuthRequest): Promise<boolean>;
  /**
   * Marca o código como gasto, e só se ainda não estiver.
   *
   * `false` é a recusa que importa: um código de autorização apresentado duas vezes significa que
   * alguém o leu no caminho, e a spec manda tratar a segunda troca como ataque.
   */
  consume(requestId: string): Promise<boolean>;
}
