import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { AgentSession } from './authenticateAgent';

export interface AgentRun {
  context: WorkflowContext;
  /** O que o executor registrou, para o agente poder ler o motivo de uma recusa. */
  logs: { message: string; params?: Record<string, string> }[];
}

/**
 * O contexto de execução de uma operação de agente.
 *
 * O `actor` carrega as permissões EFETIVAS — a interseção —, e não as do usuário. É a diferença que
 * decide um vazamento: `hasPermission(...)` dentro de um filtro por expressão de relatório, ou dentro
 * de um Script, é respondido a partir daqui. Passar o conjunto do usuário faria o teto declarado no
 * token valer para as ferramentas e não valer para a expressão dentro de uma delas.
 */
export const agentRun = (session: AgentSession, operation: string): AgentRun => {
  const logs: AgentRun['logs'] = [];
  const logger: WorkflowLogger = {
    info: (message, params) => logs.push({ message, ...(params ? { params } : {}) }),
    warn: (message, params) => logs.push({ message, ...(params ? { params } : {}) }),
    error: (message, params) => logs.push({ message, ...(params ? { params } : {}) }),
  };

  return {
    logs,
    context: {
      event: {
        id: '',
        tenantId: session.tenantId,
        name: `agent.${operation}`,
        payload: {},
        timestamp: new Date(),
      },
      outputs: {},
      variables: {},
      services: { logger, now: () => new Date() },
      logger,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId: session.tenantId },
      actor: { userId: session.userId, permissions: session.permissions },
      input: {},
    },
  };
};

/**
 * Quem consta como autor de uma gravação feita pelo agente: a PESSOA.
 *
 * É ela que responde pelo que o agente faz — o acesso é dela, e é o conjunto dela que limita o dele.
 * E é o único valor que a auditoria consegue resolver: `resolveActor` procura o uid em `userProfiles`
 * e `users`, então qualquer coisa composta (`uid#agent:xyz`) apareceria na tela de Auditoria como
 * "usuário desconhecido" — que é pior do que não distinguir, porque perde também o nome da pessoa.
 *
 * Distinguir NA AUDITORIA qual agente gravou exigiria um campo de ator próprio no registro de
 * auditoria, e não um valor enfiado no campo de autor de um documento de negócio. Fica de fora, e o
 * que se sabe hoje sobre o uso de um acesso é o `lastUsedAt` dele.
 */
export const agentWriteActor = (session: AgentSession): string => session.userId;
