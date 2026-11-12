// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/personalReport.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/personalReport.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Onde mora o relatório PESSOAL: `tenants/{tenantId}/personalReports/{id}`, com `ownerId`.
 *
 * Coleção própria, e não um campo de visibilidade em `reports`, porque a regra do Firestore não filtra:
 * a lista de relatórios lê a coleção inteira, e uma regra que dependesse do autor de cada documento a
 * recusaria para todo mundo. Os relatórios do escritório — e o instalador, o MCP e as automações que os
 * leem — continuam exatamente como eram.
 *
 * O id é gerado, nunca a chave: a coleção é de todos os membros, e duas pessoas podem dar a mesma
 * chave ao relatório delas.
 */
export const PERSONAL_REPORTS_COLLECTION = 'personalReports';
