import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { IWorkflowMutationRepository } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import {
  coerceWriteValue,
  flattenDataLeaves,
  resolveLeafType,
  resolveWritableTable,
  setValueAtPath,
  validateRemoveSpec,
  validateUpsertSpec,
  validateWritablePath,
} from '../../../domain/schema/mutationSpec';
import type { RemoveSpec, ResolvedWritableTable, UpsertSpec } from '../../../domain/schema/mutationSpec';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { formatAndValidateRecord } from '../../../domain/schema/recordRules';

const WORKFLOW_ACTOR = 'workflow-engine';

export interface WorkflowMutationDeps {
  mutationRepository: IWorkflowMutationRepository;
  screenProvider: IScreenDefinitionProvider;
}

export interface UpsertOptions {
  // Quando true, campos não graváveis do objeto (reservados do sistema, denormalizados de
  // referência, inexistentes) são silenciosamente descartados em vez de invalidar a gravação.
  // Usado pelo Step "Gravar Registro", que recebe um objeto inteiro (ex.: um registro já
  // existente) e não deve falhar por ele carregar campos que o sistema gerencia.
  ignoreUnwritableFields?: boolean;
}

interface WritableLeavesOutcome {
  spec: UpsertSpec;
  discarded: string[];
}

const keepWritableLeaves = (
  spec: UpsertSpec,
  ctx: ReturnType<typeof createSchemaContext>,
): WritableLeavesOutcome => {
  const data: Record<string, unknown> = {};
  const discarded: string[] = [];
  for (const leaf of flattenDataLeaves(spec.data)) {
    const error = validateWritablePath(ctx, spec.table, leaf.path);
    if (error) {
      discarded.push(`${leaf.path} (${error})`);
      continue;
    }
    setValueAtPath(data, leaf.path, leaf.value);
  }
  return { spec: { ...spec, data }, discarded };
};

export interface UpsertResult {
  id: string;
  created: boolean;
  record: Record<string, unknown>;
}

export interface RemoveResult {
  id: string;
  removed: boolean;
}

export type WorkflowMutationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const buildFieldPayload = (
  spec: UpsertSpec,
  resolved: ResolvedWritableTable,
  ctx: ReturnType<typeof createSchemaContext>,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const leaf of flattenDataLeaves(spec.data)) {
    const type = resolved.kind === 'lookup' ? undefined : resolveLeafType(ctx, resolved.root, leaf.path);
    setValueAtPath(payload, leaf.path, coerceWriteValue(type, leaf.value));
  }
  return payload;
};

export async function runWorkflowUpsert(
  spec: UpsertSpec,
  context: WorkflowContext,
  deps: WorkflowMutationDeps,
  options: UpsertOptions = {},
): Promise<WorkflowMutationOutcome<UpsertResult>> {
  const tenantId = context.execution.tenantId;
  const ctx = await deps.screenProvider.getSchemaContext(tenantId);

  let effectiveSpec = spec;
  if (options.ignoreUnwritableFields) {
    const kept = keepWritableLeaves(spec, ctx);
    effectiveSpec = kept.spec;
    if (kept.discarded.length > 0) {
      context.logger.warn(
        `Gravação em "${spec.table}": ${kept.discarded.length} campo(s) não gravável(is) foram ignorados — ${kept.discarded.join('; ')}`,
      );
    }
  }

  const issues = validateUpsertSpec(effectiveSpec, ctx);
  if (issues.length > 0) {
    return { ok: false, error: `Gravação inválida: ${issues.map((i) => `${i.field}: ${i.error}`).join('; ')}` };
  }

  const resolved = resolveWritableTable(effectiveSpec.table, ctx);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const target = resolved.value;
  const collection = target.physicalCollection;

  // O registro existente é lido ANTES das regras: ele é a base do escopo dos campos computados,
  // sem a qual um update parcial recalcularia com as dependências ausentes do payload.
  const id = effectiveSpec.id?.trim();
  const existing = id ? await deps.mutationRepository.getById(tenantId, collection, id) : null;

  const ruled = formatAndValidateRecord(ctx, effectiveSpec.table, effectiveSpec.data, {
    baseline: existing ?? undefined,
  });
  if (ruled.issues.length > 0) {
    return { ok: false, error: `Gravação inválida: ${describeRuleIssues(ruled.issues)}` };
  }
  const ruledSpec: UpsertSpec = { ...effectiveSpec, data: ruled.data };

  const payload = buildFieldPayload(ruledSpec, target, ctx);

  let created: boolean;
  let finalId: string;
  if (id && existing) {
    await deps.mutationRepository.update(tenantId, collection, id, { ...payload, updatedBy: WORKFLOW_ACTOR });
    created = false;
    finalId = id;
  } else {
    finalId = await deps.mutationRepository.create(
      tenantId,
      collection,
      { ...payload, createdBy: WORKFLOW_ACTOR, updatedBy: WORKFLOW_ACTOR },
      id,
    );
    created = true;
  }

  const stored = await deps.mutationRepository.getById(tenantId, collection, finalId);
  return { ok: true, value: { id: finalId, created, record: { id: finalId, ...(stored ?? {}) } } };
}

export async function runWorkflowRemove(
  spec: RemoveSpec,
  context: WorkflowContext,
  deps: WorkflowMutationDeps,
): Promise<WorkflowMutationOutcome<RemoveResult>> {
  const tenantId = context.execution.tenantId;
  const ctx = await deps.screenProvider.getSchemaContext(tenantId);

  const issues = validateRemoveSpec(spec, ctx);
  if (issues.length > 0) {
    return { ok: false, error: `Exclusão inválida: ${issues.map((i) => `${i.field}: ${i.error}`).join('; ')}` };
  }

  const resolved = resolveWritableTable(spec.table, ctx);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const target = resolved.value;
  const collection = target.physicalCollection;
  const id = spec.id.trim();

  const existing = await deps.mutationRepository.getById(tenantId, collection, id);
  if (!existing) {
    return { ok: true, value: { id, removed: false } };
  }
  await deps.mutationRepository.delete(tenantId, collection, id);
  return { ok: true, value: { id, removed: true } };
}
