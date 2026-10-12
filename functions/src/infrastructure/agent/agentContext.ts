import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { AgentSession } from './authenticateAgent';
import { identifyActor } from '../workflow/identifyActor';
import { tenantTimeZone } from '../settings/tenantTimeZone';

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
 *
 * O AUTOR de uma gravação feita pelo agente é a PESSOA, com `via: 'agent'`. É ela que responde pelo que
 * ele faz — o acesso é dela, e é o conjunto dela que limita o dele. E é o único valor que a auditoria
 * consegue resolver: `resolveActor` procura o uid em `userProfiles` e `users`, então qualquer coisa
 * composta (`uid#agent:xyz`) apareceria na tela de Auditoria como "usuário desconhecido" — pior do que
 * não distinguir, porque perde também o nome da pessoa. Distinguir que foi o agente é o papel de
 * `createdVia`/`updatedVia`, um campo À PARTE, e não de um autor composto.
 */
export const agentRun = async (session: AgentSession, operation: string): Promise<AgentRun> => {
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
      services: { logger, now: () => new Date(), timeZone: await tenantTimeZone(session.tenantId, session.userId) },
      logger,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId: session.tenantId },
      actor: await identifyActor(session.userId, 'agent', session.permissions),
      input: {},
    },
  };
};
