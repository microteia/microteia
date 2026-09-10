import type { AgentGrant } from '../schema/agent/agentGrant';

/** O que a tela informa ao emitir. O segredo, o hash e o id são do servidor. */
export interface AgentGrantInput {
  name: string;
  /** O TETO — ids do catálogo de permissões do escritório. Nunca o curinga. */
  permissions: string[];
  /** `null` = sem expiração. A revogação continua sendo o caminho garantido. */
  expiresInDays: number | null;
}

export interface IssuedAgentGrant {
  grantId: string;
  /**
   * O token em claro, e esta é a ÚNICA vez que ele existe: o Firestore guarda só o hash. A tela o
   * mostra uma vez e não tem como recuperá-lo depois — perdido, emite-se outro.
   */
  token: string;
}

/**
 * Os acessos de agente de IA.
 *
 * A LEITURA é direta do Firestore, autorizada pela regra (o dono lê o seu, quem tem `agent.manage` lê
 * todos). A ESCRITA é por callable, sem exceção: o segredo tem de ser sorteado no servidor e o
 * documento só pode nascer com o hash dele — uma escrita direta permitiria gravar um `secretHash`
 * escolhido, e quem escolhe o hash escolhe o token.
 */
export interface IAgentGrantRepository {
  subscribe(
    tenantId: string,
    onUpdate: (grants: AgentGrant[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  issue(tenantId: string, input: AgentGrantInput): Promise<IssuedAgentGrant>;
  revoke(tenantId: string, grantId: string): Promise<boolean>;
}
