import type { AgentGrant } from '../../domain/schema/agent/agentGrant';
import {
  effectiveAgentPermissions,
  grantRefusal,
  hashAgentSecret,
  parseAgentToken,
  secretHashMatches,
} from '../../domain/schema/agent/agentGrant';
import { AGENT_MCP_FUNCTION } from '../../domain/schema/agent/agentBackend';
import { getDI } from '../di/container';
import { grantedPermissions } from '../handlers/shared/requirePermission';

/**
 * Por que o acesso foi recusado.
 *
 * `unknown` cobre DUAS situações que não podem ser distinguidas: o acesso não existe, e o segredo não
 * bate. Separá-las diria a quem tenta se aquele id de acesso existe — e um oráculo de existência é
 * meio caminho para adivinhar o outro metade. As duas respondem igual, e o registro interno também.
 */
export type AgentAuthRefusal =
  | 'malformed'
  | 'inactive'
  | 'unknown'
  | 'revoked'
  | 'expired'
  | 'no-access';

export interface AgentSession {
  tenantId: string;
  userId: string;
  grantId: string;
  grantName: string;
  /** O que este acesso PODE: a interseção, recalculada nesta chamada. */
  permissions: string[];
  /** O teto declarado no acesso, para o recurso `office/info` poder mostrar a diferença. */
  ceiling: string[];
  expiresAt: Date | null;
  /** Quando este acesso foi usado da última vez, para o carimbo não ser gravado a cada chamada. */
  lastUsedAt: Date | null;
}

export type AgentAuthOutcome =
  | { ok: true; session: AgentSession }
  | { ok: false; refusal: AgentAuthRefusal };

/**
 * As leituras, nomeadas em vez de posicionais — e injetadas para que a ORDEM das recusas seja
 * exercitada em teste sem Firestore nenhum. É o mesmo arranjo de `installationGate.ts`, e pelo mesmo
 * motivo: a lógica que decide quem entra é a que mais precisa de teste e a que menos pode depender de
 * um emulador para tê-lo.
 */
export interface AgentAuthDeps {
  readGrant: (tenantId: string, grantId: string) => Promise<AgentGrant | null>;
  claimsFunction: (tenantId: string, functionName: string) => Promise<boolean>;
  granted: (tenantId: string, userId: string) => Promise<string[]>;
  now: () => Date;
}

/**
 * O token vira uma sessão, ou não vira nada.
 *
 * **Falha fechada em cada passo, e a ordem não é arbitrária.** O portão da extensão vem ANTES da
 * leitura do acesso: num escritório que desativou a extensão, nem a existência de um acesso é
 * observável — o desligamento é completo, e não "responde diferente". Vem antes também por custo, já
 * que ele é servido por cache e a leitura do acesso não é.
 *
 * A interseção vazia é recusada aqui em vez de deixada para cada operação. Um acesso que não alcança
 * nada não é um acesso degradado: quem o emitiu perdeu os perfis, ou o teto foi declarado com ids que
 * ele nunca teve. Responder "sem permissão" a cada uma das ferramentas esconderia isso atrás de
 * dez mensagens; recusar a sessão diz o que aconteceu, uma vez.
 */
export const authenticateAgent = async (
  rawToken: unknown,
  deps: AgentAuthDeps,
): Promise<AgentAuthOutcome> => {
  const parsed = parseAgentToken(rawToken);
  if (parsed === null) return { ok: false, refusal: 'malformed' };

  if (!(await deps.claimsFunction(parsed.tenantId, AGENT_MCP_FUNCTION))) {
    return { ok: false, refusal: 'inactive' };
  }

  const grant = await deps.readGrant(parsed.tenantId, parsed.grantId);
  // Sem dono não há de quem cruzar as permissões, e a interseção com um `userId` vazio seria a
  // resposta de outra pergunta. A checagem é redundante com o repositório de propósito: esta é a
  // fronteira, e uma fronteira que confia no filtro de quem a alimenta não é fronteira.
  if (grant === null || grant.userId === '') return { ok: false, refusal: 'unknown' };

  const presented = await hashAgentSecret(parsed.secret);
  if (!secretHashMatches(grant.secretHash, presented)) return { ok: false, refusal: 'unknown' };

  const refusal = grantRefusal(grant, deps.now());
  if (refusal !== null) return { ok: false, refusal };

  const permissions = effectiveAgentPermissions(
    await deps.granted(parsed.tenantId, grant.userId),
    grant.permissions,
  );
  if (permissions.length === 0) return { ok: false, refusal: 'no-access' };

  return {
    ok: true,
    session: {
      tenantId: parsed.tenantId,
      userId: grant.userId,
      grantId: grant.id,
      grantName: grant.name,
      permissions,
      ceiling: [...grant.permissions],
      expiresAt: grant.expiresAt,
      lastUsedAt: grant.lastUsedAt,
    },
  };
};

/** As leituras de verdade. */
export const agentAuthDeps = (): AgentAuthDeps => ({
  readGrant: (tenantId, grantId) => getDI().getAgentGrantRepository().getById(tenantId, grantId),
  claimsFunction: (tenantId, functionName) =>
    getDI().getInstalledExtensionCache().claimsFunction(tenantId, functionName),
  granted: grantedPermissions,
  now: () => new Date(),
});
