// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/agent/agentBackend.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * As Cloud Functions que servem o acesso de agente.
 *
 * Os nomes moram aqui, e não escritos duas vezes, porque eles são o CONTRATO entre três lugares que
 * não se olham: o `functions/src/index.ts` que as exporta, o `manifest.backend.functions` da extensão
 * que as reivindica, e o portão que pergunta se alguma extensão instalada as reivindica. Um nome
 * digitado diferente em qualquer um dos três não falha em lugar visível — a function simplesmente
 * nunca é deployada, ou nunca atende.
 */
export const AGENT_MCP_FUNCTION = 'agentMcp';
export const AGENT_CREATE_GRANT_FUNCTION = 'createAgentGrant';
export const AGENT_REVOKE_GRANT_FUNCTION = 'revokeAgentGrant';

export const AGENT_BACKEND_FUNCTIONS: readonly string[] = [
  AGENT_MCP_FUNCTION,
  AGENT_CREATE_GRANT_FUNCTION,
  AGENT_REVOKE_GRANT_FUNCTION,
];
