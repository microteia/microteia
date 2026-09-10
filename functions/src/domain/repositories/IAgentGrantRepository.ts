import type { AgentGrant } from '../schema/agent/agentGrant';

/** O que a emissão precisa informar. O `id`, o hash e os carimbos de tempo são do repositório. */
export interface NewAgentGrant {
  name: string;
  userId: string;
  permissions: string[];
  secretHash: string;
  expiresAt: Date | null;
  createdBy: string;
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
}
