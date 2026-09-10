import type { AgentToolDefinition } from '../../domain/schema/agent/agentOps';
import { agentToolByName } from '../../domain/schema/agent/agentOps';
import type { CrudAction } from '../../domain/schema/access/permission';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { grants } from '../../domain/schema/access/memberPermissions';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import type { AgentSession } from './authenticateAgent';
import { isVocabulary } from './describeScreen';

/**
 * A permissão que uma chamada precisa, decidida a partir da DECLARAÇÃO da ferramenta e do argumento.
 *
 * `delegated` é o relatório: quem executa cobra, porque só ele sabe quais coleções o spec alcança —
 * inclusive as alcançadas por referência, que nenhuma regra escrita aqui saberia enumerar.
 */
export type PermissionCharge =
  | { kind: 'charge'; permission: string }
  | { kind: 'vocabulary' }
  | { kind: 'delegated' }
  | { kind: 'missing-collection' };

export const permissionCharge = (
  ctx: SchemaContext,
  tool: AgentToolDefinition,
  input: Record<string, unknown>,
): PermissionCharge => {
  if (tool.permission.kind === 'fixed') return { kind: 'charge', permission: tool.permission.id };
  if (tool.permission.kind === 'delegated') return { kind: 'delegated' };

  const collection = typeof input.collection === 'string' ? input.collection.trim() : '';
  if (collection === '') return { kind: 'missing-collection' };

  const action: CrudAction = tool.permission.action;
  // A leitura de uma lista de opções ou de um conjunto de etiquetas não é cobrada, porque
  // `firestore.rules` não a cobra: `isDeclaredVocabulary` a libera a qualquer membro. Divergir aqui
  // faria a mesma pergunta ter duas respostas — e obrigaria quem emite um acesso a listar cada lista
  // do escritório só para um campo de seleção poder ser preenchido. A ESCRITA continua cobrada.
  if (action === 'read' && isVocabulary(ctx, collection)) return { kind: 'vocabulary' };

  return { kind: 'charge', permission: collectionPermissionId(collection, action) };
};

export type AuthorizationOutcome =
  | { ok: true }
  | { ok: false; error: string; params?: Record<string, string> };

export const authorizeOperation = (
  session: AgentSession,
  charge: PermissionCharge,
): AuthorizationOutcome => {
  if (charge.kind === 'missing-collection') {
    return { ok: false, error: '@core.automation/handler.tenant.missing' };
  }
  if (charge.kind === 'vocabulary' || charge.kind === 'delegated') return { ok: true };
  return grants(session.permissions, charge.permission)
    ? { ok: true }
    : { ok: false, error: '@core.access/permission.denied', params: { permission: charge.permission } };
};

/**
 * A ferramenta pedida, ou a recusa.
 *
 * Um nome desconhecido é recusa de PROTOCOLO e não de permissão: quem chama devolve a lista das que
 * existem, porque um modelo que errou o nome corrige na chamada seguinte se souber os certos.
 */
export const resolveTool = (name: string): AgentToolDefinition | null => agentToolByName(name);
