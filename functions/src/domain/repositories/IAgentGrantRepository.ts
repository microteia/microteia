import type { AgentGrant, AgentGrantOrigin } from '../schema/agent/agentGrant';

/** O que a emissão precisa informar. O `id`, o hash e os carimbos de tempo são do repositório. */
export interface NewAgentGrant {
  name: string;
  userId: string;
  permissions: string[];
  secretHash: string;
  expiresAt: Date | null;
  createdBy: string;
  /** Ausente é `manual` — o caminho da tela, que é o que existia antes do OAuth. */
  origin?: AgentGrantOrigin;
  accessExpiresAt?: Date | null;
  refreshHash?: string | null;
  clientId?: string | null;
}

/**
 * A troca do par de segredos de um acesso de OAuth, numa escrita só.
 *
 * Numa só porque as duas metades têm de morrer juntas: gravar o segredo novo e falhar no refresh
 * deixaria o cliente com um access token que funciona e um refresh que não, e ele descobriria isso
 * uma hora depois, sem caminho de volta.
 */
export interface RotatedAgentGrant {
  secretHash: string;
  refreshHash: string;
  accessExpiresAt: Date;
}

/**
 * Os acessos de agente de um escritório.
 *
 * Não há `list` aqui de propósito: a tela lê a coleção direto do Firestore, autorizada pela regra
 * (`agentGrants` libera a leitura ao dono do acesso e a quem tem `agent.manage`). Uma callable de
 * listagem seria uma segunda resposta à mesma pergunta, e a que pudesse divergir da regra.
 */
export interface IAgentGrantRepository {
  getById(tenantId: string, grantId: string): Promise<AgentGrant | null>;
  create(tenantId: string, grant: NewAgentGrant): Promise<string>;
  /** `false` quando o acesso não existe ou já estava revogado — revogar é idempotente. */
  revoke(tenantId: string, grantId: string, actorId: string): Promise<boolean>;
  /**
   * Carimba o uso. É deliberadamente disparado e não aguardado por quem chama: uma escrita a mais no
   * caminho de toda operação do agente não pode ser o que decide se ela responde.
   */
  touchLastUsed(tenantId: string, grantId: string): Promise<void>;
  /**
   * Troca o par de segredos, e só se o refresh apresentado ainda for o vigente.
   *
   * A condição é o que torna a rotação uma DEFESA e não só uma higiene: dois usos do mesmo refresh
   * token significam que alguém tem uma cópia, e o segundo tem de falhar. `false` é essa recusa.
   */
  rotate(
    tenantId: string,
    grantId: string,
    expectedRefreshHash: string | null,
    next: RotatedAgentGrant,
  ): Promise<boolean>;
}
