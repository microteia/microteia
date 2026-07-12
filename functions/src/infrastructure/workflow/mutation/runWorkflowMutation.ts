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
} from '../../../domain/schema/mutationSpec';
import type { RemoveSpec, ResolvedWritableTable, UpsertSpec } from '../../../domain/schema/mutationSpec';

const CREATED_BY_WORKFLOW = 'workflow-engine';
const UNTITLED_RECORD = 'Sem título';

export interface WorkflowMutationDeps {
  mutationRepository: IWorkflowMutationRepository;
  screenProvider: IScreenDefinitionProvider;
}

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
): Promise<WorkflowMutationOutcome<UpsertResult>> {
  const tenantId = context.execution.tenantId;
  const screens = await deps.screenProvider.getScreens(tenantId);
  const ctx = createSchemaContext(screens);

  const issues = validateUpsertSpec(spec, ctx);
  if (issues.length > 0) {
    return { ok: false, error: `Gravação inválida: ${issues.map((i) => `${i.field}: ${i.error}`).join('; ')}` };
  }

  const resolved = resolveWritableTable(spec.table, ctx);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const target = resolved.value;
  const collection = target.physicalCollection;

  const payload = buildFieldPayload(spec, target, ctx);

  if (target.kind === 'custom' && target.screenKey) {
    payload.screenKey = target.screenKey;
    const screen = screens.find((s) => s.id === target.screenKey);
    const values = (payload.values as Record<string, unknown> | undefined) ?? {};
    const titleValue = screen?.titleFieldKey ? values[screen.titleFieldKey] : undefined;
    payload.title = typeof titleValue === 'string' && titleValue.trim() !== '' ? titleValue.trim() : UNTITLED_RECORD;
  }

  const id = spec.id?.trim();
  const existing = id ? await deps.mutationRepository.getById(tenantId, collection, id) : null;

  if (existing && target.kind === 'custom' && existing.screenKey !== target.screenKey) {
    return { ok: false, error: 'O registro informado pertence a outra tela e não pode ser alterado' };
  }

  let created: boolean;
  let finalId: string;
  if (id && existing) {
    await deps.mutationRepository.update(tenantId, collection, id, payload);
    created = false;
    finalId = id;
  } else {
    finalId = await deps.mutationRepository.create(
      tenantId,
      collection,
      { ...payload, createdBy: CREATED_BY_WORKFLOW },
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
  const screens = await deps.screenProvider.getScreens(tenantId);
  const ctx = createSchemaContext(screens);

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
  if (target.kind === 'custom' && existing.screenKey !== target.screenKey) {
    return { ok: false, error: 'O registro informado pertence a outra tela e não pode ser excluído' };
  }

  await deps.mutationRepository.delete(tenantId, collection, id);
  return { ok: true, value: { id, removed: true } };
}
