// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowVersion.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowVersion.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { canonicalJson } from './contentFingerprint';

/** `tenants/{t}/workflow_definitions/{id}/versions/{n}` — imutável; só o kernel grava. */
export const WORKFLOW_VERSIONS_SUBCOLLECTION = 'versions';

/**
 * O que é a AUTOMAÇÃO, e não o estado dela: o que, se muda, faz uma execução de antes e uma de depois
 * serem duas automações diferentes. `enabled` fica de fora — desligar não é editar —, e a identidade e a
 * origem (`ownerPluginIds`, `sourceRev`) também: são de quem a instalou, não do que ela faz.
 */
export const WORKFLOW_VERSION_CONTENT_KEYS = [
  'name',
  'description',
  'eventName',
  'lookupCollection',
  'parameters',
  'schedule',
  'dateReached',
  'changeType',
  'changedFields',
  'condition',
  'steps',
] as const;

export type WorkflowVersionContent = Partial<Record<typeof WORKFLOW_VERSION_CONTENT_KEYS[number], unknown>>;

/**
 * QUEM escreveu o conteúdo: uma edição (a tela, a restauração, um agente) ou a instalação de uma
 * extensão, com a revisão do pacote. Gravado na definição por quem grava (`contentOrigin`) e copiado para
 * a versão — o servidor não tem como adivinhar de onde veio uma gravação.
 */
export type WorkflowContentOrigin =
  | { kind: 'edit' }
  | { kind: 'extension'; pluginId: string; sourceRev: number | null };

export const EDIT_ORIGIN: WorkflowContentOrigin = { kind: 'edit' };

export interface WorkflowVersion {
  version: number;
  savedAt: Date;
  content: WorkflowVersionContent;
  origin: WorkflowContentOrigin;
}

/** A origem gravada, ou EDIÇÃO quando não há uma válida — o que todo caminho antigo de gravação era. */
export const contentOriginOf = (value: unknown): WorkflowContentOrigin => {
  const origin = value as { kind?: unknown; pluginId?: unknown; sourceRev?: unknown } | null | undefined;
  if (origin?.kind === 'extension' && typeof origin.pluginId === 'string' && origin.pluginId !== '') {
    return { kind: 'extension', pluginId: origin.pluginId, sourceRev: typeof origin.sourceRev === 'number' ? origin.sourceRev : null };
  }
  return EDIT_ORIGIN;
};

/**
 * A MESMA instalação: mesma extensão e mesma revisão. É o que junta as duas passadas de uma atualização
 * (o conteúdo, depois o remapeamento dos ids de `call-workflow`) numa versão só.
 */
export const sameInstallation = (left: WorkflowContentOrigin | null, right: WorkflowContentOrigin): boolean =>
  left?.kind === 'extension' && right.kind === 'extension'
  && left.pluginId === right.pluginId && left.sourceRev === right.sourceRev;

export const workflowVersionContent = (definition: Record<string, unknown>): WorkflowVersionContent =>
  Object.fromEntries(
    WORKFLOW_VERSION_CONTENT_KEYS
      .filter((key) => definition[key] !== undefined && definition[key] !== null)
      .map((key) => [key, definition[key]]),
  );

/** O conteúdo é o MESMO — a ordem das chaves, que o Firestore não preserva, não conta. */
export const sameWorkflowContent = (left: Record<string, unknown>, right: Record<string, unknown>): boolean =>
  canonicalJson(workflowVersionContent(left)) === canonicalJson(workflowVersionContent(right));
