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
import { ruleIssueParams } from '../../../domain/schema/fieldRules';
import type { DescribableIssue } from '../../../domain/schema/fieldRules';
import { formatAndValidateRecord } from '../../../domain/schema/recordRules';
import {
  diffRecordKeys,
  planRecordKeys,
  RECORD_KEY_REFS_FIELD,
  storedRecordKeyRefs,
} from '../../../domain/schema/recordKeys';
import { resolveEntityKeys } from '../../../domain/schema/screenEntity';
import { RecordKeyTakenError } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { RecordKeyMutation } from '../../../domain/repositories/IWorkflowMutationRepository';

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
  /**
   * Quem grava, para `createdBy`/`updatedBy` — e portanto para a AUTORIA que a auditoria mostra.
   *
   * O padrão continua sendo o motor, que é a verdade quando o motor gravou. O acesso de agente passa
   * o seu próprio ator: dizer "workflow-engine" numa gravação feita por um agente de IA a pedido de
   * uma pessoa seria mentir no único campo pelo qual alguém consegue rastreá-la depois.
   */
  writeActor?: string;
}

interface WritableLeavesOutcome {
  spec: UpsertSpec;
  discarded: DescribableIssue[];
}

const keepWritableLeaves = (
  spec: UpsertSpec,
  ctx: ReturnType<typeof createSchemaContext>,
): WritableLeavesOutcome => {
  const data: Record<string, unknown> = {};
  const discarded: DescribableIssue[] = [];
  for (const leaf of flattenDataLeaves(spec.data)) {
    const issue = validateWritablePath(ctx, spec.table, leaf.path);
    if (issue) {
      // O motivo sobe como REFERÊNCIA, não colado numa frase: é o que permite ao aviso dizer na
      // tela POR QUE o campo não entrou, em vez de mostrar a chave crua no meio do texto.
      discarded.push({ label: leaf.path, error: issue.error, errorParams: issue.errorParams });
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
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

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
  const actor = options.writeActor ?? WORKFLOW_ACTOR;

  let effectiveSpec = spec;
  if (options.ignoreUnwritableFields) {
    const kept = keepWritableLeaves(spec, ctx);
    effectiveSpec = kept.spec;
    if (kept.discarded.length > 0) {
      context.logger.warn('@core.automation/mutation.upsert.unwritable-ignored', {
        table: spec.table,
        count: String(kept.discarded.length),
        ...ruleIssueParams(kept.discarded),
      });
    }
  }

  const issues = validateUpsertSpec(effectiveSpec, ctx);
  if (issues.length > 0) {
    return {
      ok: false,
      error: '@core.automation/mutation.upsert.invalid',
      errorParams: ruleIssueParams(
        issues.map((issue) => ({ label: issue.field, error: issue.error, errorParams: issue.errorParams })),
      ),
    };
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
    return {
      ok: false,
      error: '@core.automation/mutation.upsert.invalid',
      errorParams: ruleIssueParams(ruled.issues),
    };
  }
  const ruledSpec: UpsertSpec = { ...effectiveSpec, data: ruled.data };

  const payload = buildFieldPayload(ruledSpec, target, ctx);

  // A automação passa pelo MESMO planejamento do formulário, e sobre o registro inteiro: uma chave
  // composta cujo upsert toca um campo só continua sendo a mesma chave. Sem isto, o caminho do
  // backend furaria a chave que o front respeita — e uma unicidade que um dos dois caminhos ignora
  // não é unicidade.
  const declaredKeys = resolveEntityKeys(ctx, collection);
  let keyMutation: RecordKeyMutation | undefined;
  let keyRefs: Record<string, string> | undefined;
  if (declaredKeys.length > 0) {
    const merged = { ...(existing ?? {}), ...payload };
    const plan = planRecordKeys(declaredKeys, merged, collection, ctx.fieldRulePresets);
    if (plan.gaps.length > 0) {
      return {
        ok: false,
        error: '@core.automation/mutation.upsert.key-required',
        errorParams: {
          key: plan.gaps[0].name,
          fields: plan.gaps.map((gap) => gap.fields.join(', ')).join('; '),
        },
      };
    }
    const diff = diffRecordKeys(plan, storedRecordKeyRefs(existing));
    keyMutation = {
      create: diff.create.map((entry) => ({
        keyId: entry.keyId,
        keyName: entry.name,
        values: entry.values,
      })),
      release: diff.release,
    };
    keyRefs = diff.refs;
  }
  const withKeys = keyRefs === undefined ? payload : { ...payload, [RECORD_KEY_REFS_FIELD]: keyRefs };

  let created: boolean;
  let finalId: string;
  try {
    if (id && existing) {
      await deps.mutationRepository.update(
        tenantId,
        collection,
        id,
        { ...withKeys, updatedBy: actor },
        keyMutation,
      );
      created = false;
      finalId = id;
    } else {
      finalId = await deps.mutationRepository.create(
        tenantId,
        collection,
        { ...withKeys, createdBy: actor, updatedBy: actor },
        id,
        keyMutation,
      );
      created = true;
    }
  } catch (error) {
    if (error instanceof RecordKeyTakenError) {
      return {
        ok: false,
        error: '@core.automation/mutation.upsert.key-conflict',
        errorParams: { key: error.keyName, value: error.values.join(' + ') },
      };
    }
    throw error;
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
    return {
      ok: false,
      error: '@core.automation/mutation.remove.invalid',
      errorParams: ruleIssueParams(
        issues.map((issue) => ({ label: issue.field, error: issue.error, errorParams: issue.errorParams })),
      ),
    };
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
  // As reservas saem no mesmo gesto do registro — e são achadas pelo que o REGISTRO cita, nunca
  // recomputadas: uma reserva feita sob a declaração anterior só existe em `keyRefs`.
  await deps.mutationRepository.delete(
    tenantId,
    collection,
    id,
    Object.values(storedRecordKeyRefs(existing)),
  );
  return { ok: true, value: { id, removed: true } };
}
