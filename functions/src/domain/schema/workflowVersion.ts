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

/**
 * `tenants/{t}/<coleção>/{id}/versions/{n}` — imutável; só o kernel grava. Vale para a automação e para
 * o script: os dois são editados no escritório E trazidos por extensão, e os dois mudam o que uma
 * execução faz.
 */
export const WORKFLOW_VERSIONS_SUBCOLLECTION = 'versions';

/** As coleções versionadas, pelo artefato. */
export const VERSIONED_ARTIFACT_COLLECTIONS = { workflow: 'workflow_definitions', script: 'scripts' } as const;
export type VersionedArtifact = keyof typeof VERSIONED_ARTIFACT_COLLECTIONS;

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

/**
 * O que é o SCRIPT: o código e o contrato dele. O compilado vai junto — é derivado da fonte, mas é ele que
 * roda, e restaurar uma versão sem ele exigiria compilar no servidor.
 */
export const SCRIPT_VERSION_CONTENT_KEYS = ['name', 'description', 'sourceTs', 'compiledJs', 'inputParams', 'outputParams'] as const;

export const ARTIFACT_VERSION_CONTENT_KEYS: Readonly<Record<VersionedArtifact, readonly string[]>> = {
  workflow: WORKFLOW_VERSION_CONTENT_KEYS,
  script: SCRIPT_VERSION_CONTENT_KEYS,
};

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

/** Uma versão de qualquer artefato versionado — a de automação é o caso particular. */
export interface ArtifactVersion {
  version: number;
  savedAt: Date;
  content: Record<string, unknown>;
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

export const versionContentOf = (keys: readonly string[], record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    keys
      .filter((key) => record[key] !== undefined && record[key] !== null)
      .map((key) => [key, record[key]]),
  );

/** O conteúdo é o MESMO — a ordem das chaves, que o Firestore não preserva, não conta. */
export const sameVersionContent = (
  keys: readonly string[],
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean => canonicalJson(versionContentOf(keys, left)) === canonicalJson(versionContentOf(keys, right));

export const workflowVersionContent = (definition: Record<string, unknown>): WorkflowVersionContent =>
  versionContentOf(WORKFLOW_VERSION_CONTENT_KEYS, definition) as WorkflowVersionContent;

export const sameWorkflowContent = (left: Record<string, unknown>, right: Record<string, unknown>): boolean =>
  sameVersionContent(WORKFLOW_VERSION_CONTENT_KEYS, left, right);
