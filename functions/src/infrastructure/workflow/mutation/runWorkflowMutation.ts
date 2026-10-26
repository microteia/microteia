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
import type { RecordWriteVia, RemoveSpec, ResolvedWritableTable, UpsertSpec } from '../../../domain/schema/mutationSpec';
import { RECORD_CREATED_VIA_FIELD, RECORD_UPDATED_VIA_FIELD } from '../../../domain/schema/mutationSpec';
import { RECORD_PORTAL_VERIFIED_FIELD, type PortalVerifiedIdentity } from '../../../domain/schema/portalIdentity';
import { ruleIssueParams } from '../../../domain/schema/fieldRules';
import type { DescribableIssue } from '../../../domain/schema/fieldRules';
import { formatAndValidateRecord, tableMentionsBusinessDays } from '../../../domain/schema/recordRules';
import { withAmbientTimeZone } from '../../../domain/schema/clockGate';
import { withAmbientBusinessCalendars } from '../../../domain/schema/time/businessDaysGate';
import { businessCalendarsFor } from '../../../domain/services/businessCalendarScope';
import {
  diffRecordKeys,
  planRecordKeys,
  RECORD_KEY_REFS_FIELD,
  storedRecordKeyRefs,
} from '../../../domain/schema/recordKeys';
import { resolveEntityKeys } from '../../../domain/schema/screenEntity';
import {
  changedRecordKeys,
  editWindowAllowsDelete,
  editWindowAllowsUpdate,
  resolveEditWindow,
} from '../../../domain/schema/editWindow';
import { readerSeesRecord, resolveMemberVisibility } from '../../../domain/schema/memberVisibility';
import { RecordKeyTakenError } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { RecordKeyMutation } from '../../../domain/repositories/IWorkflowMutationRepository';

const WORKFLOW_ACTOR = 'workflow-engine';

interface WriteAuthor {
  by: string;
  name: string | null;
  photoURL: string | null;
  via: RecordWriteVia;
  verified?: PortalVerifiedIdentity | null;
}

/**
 * Quem responde pela gravação — e portanto a AUTORIA que a auditoria e a listagem mostram.
 *
 * Vem do CONTEXTO, e não de uma opção de quem chama: o passo "Gravar Registro", o `upsert` do Script e
 * o `create_record` do agente gravam todos pela mesma regra. Com uma pessoa por trás (um botão, o
 * agente em nome do dono do token), o autor é o uid dela — o único valor que a auditoria resolve em
 * nome — e o nome e a foto saem da mesma regra do formulário. Sem pessoa, o autor é o motor.
 *
 * O nome do motor é `null`, não ausente: numa atualização, o merge deixaria o `updatedByName` da
 * pessoa anterior ao lado de `updatedBy: 'workflow-engine'`, e a auditoria atribuiria a ela uma
 * alteração que a automação fez.
 */
const authorOf = (context: WorkflowContext): WriteAuthor =>
  context.actor
    ? {
      by: context.actor.userId,
      name: context.actor.name,
      photoURL: context.actor.photoURL,
      via: context.actor.via,
      ...(context.actor.via === 'portal' ? { verified: context.actor.verified ?? null } : {}),
    }
    : { by: WORKFLOW_ACTOR, name: null, photoURL: null, via: 'automation' };

/**
 * A gravação PELO PORTAL diz também o que o convidado provou — `null` para quem entrou pelo link de
 * e-mail, e é por isso que o `null` é gravado: a prova da gravação anterior não pode ficar atribuída a
 * esta. As outras portas não tocam o campo: ele fala da última gravação feita pelo portal.
 */
const updateStamp = (author: WriteAuthor): Record<string, unknown> => ({
  updatedBy: author.by,
  updatedByName: author.name,
  updatedByPhotoURL: author.photoURL,
  [RECORD_UPDATED_VIA_FIELD]: author.via,
  ...(author.verified !== undefined ? { [RECORD_PORTAL_VERIFIED_FIELD]: author.verified } : {}),
});

/** Um registro NOVO não tem nome anterior a apagar: os `null` do motor simplesmente não entram. */
const createStamp = (author: WriteAuthor): Record<string, unknown> => Object.fromEntries(
  Object.entries({
    createdBy: author.by,
    createdByName: author.name,
    createdByPhotoURL: author.photoURL,
    [RECORD_CREATED_VIA_FIELD]: author.via,
    ...updateStamp(author),
  }).filter(([, value]) => value !== null),
);

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
   * Só ALTERA: com `id` de um registro que não existe, recusa em vez de criar. Quem já decidiu que o
   * registro existe (a alteração pelo portal, que conferiu dono e condição sobre ele) não pode, por um
   * registro apagado no meio do caminho, fazer nascer outro só com os campos que mandou.
   */
  updateOnly?: boolean;
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
  const author = authorOf(context);

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
  if (options.updateOnly && !existing) {
    return { ok: false, error: '@core.automation/mutation.upsert.not-found' };
  }
  // A pessoa por quem se grava (o agente) não altera o registro que não vê (`memberVisibility`) — como
  // na regra do Firestore. A recusa é a de quem não existe; criar continua livre, e pode nomear outra
  // pessoa. A automação não tem leitor e grava como sempre.
  if (existing && !readerSeesRecord(resolveMemberVisibility(ctx, collection), collection, context.reader, existing)) {
    return { ok: false, error: '@core.records/record.not-found' };
  }

  const calendars = await businessCalendarsFor(
    context.services,
    tenantId,
    tableMentionsBusinessDays(ctx, effectiveSpec.table),
  );
  const ruled = withAmbientBusinessCalendars(calendars, () =>
    withAmbientTimeZone(context.services.timeZone, () =>
      formatAndValidateRecord(ctx, effectiveSpec.table, effectiveSpec.data, {
        baseline: existing ?? undefined,
      }),
    ),
  );
  if (ruled.issues.length > 0) {
    return {
      ok: false,
      error: '@core.automation/mutation.upsert.invalid',
      errorParams: ruleIssueParams(ruled.issues),
    };
  }
  const ruledSpec: UpsertSpec = { ...effectiveSpec, data: ruled.data };

  const payload = buildFieldPayload(ruledSpec, target, ctx);

  // A janela de edição é conferida AQUI, e não em cada porta: o passo "Gravar Registro", o `upsert`
  // do Script, o agente e o portal passam todos por este ponto. O Admin SDK ignora o
  // `firestore.rules`, então a regra que a tela declara só vale do lado do servidor se valer aqui.
  // Quem não passa por aqui — o recálculo de agregados, a adoção de chave — não é gravação de negócio,
  // e de propósito não é barrado.
  const editWindow = resolveEditWindow(ctx, collection);
  if (editWindow && existing) {
    const allowed = editWindowAllowsUpdate(editWindow.spec, existing.createdAt, new Date(), {
      changedKeys: changedRecordKeys(existing, payload),
      memberWritableFields: editWindow.memberWritableFields,
    });
    if (!allowed) {
      return {
        ok: false,
        error: '@core.automation/mutation.upsert.edit-window-closed',
        errorParams: { minutes: String(editWindow.spec.minutes) },
      };
    }
  }

  // A automação passa pelo MESMO planejamento do formulário, e sobre o registro inteiro: uma chave
  // composta cujo upsert toca um campo só continua sendo a mesma chave. Sem isto, o caminho do
  // backend furaria a chave que o front respeita — e uma unicidade que um dos dois caminhos ignora
  // não é unicidade.
  const declaredKeys = resolveEntityKeys(ctx, collection);
  let keyMutation: RecordKeyMutation | undefined;
  let keyRefs: Record<string, string> | undefined;
  if (declaredKeys.length > 0) {
    const merged = { ...(existing ?? {}), ...payload };
    const plan = planRecordKeys(declaredKeys, merged, collection, ctx.fieldRulePresets, existing);
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
        { ...withKeys, ...updateStamp(author) },
        keyMutation,
      );
      created = false;
      finalId = id;
    } else {
      finalId = await deps.mutationRepository.create(
        tenantId,
        collection,
        { ...withKeys, ...createStamp(author) },
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
  // O registro que o leitor não vê é, para ele, o que não existe: nada é removido, e a resposta é a
  // mesma de um id que não está lá.
  if (!existing || !readerSeesRecord(resolveMemberVisibility(ctx, collection), collection, context.reader, existing)) {
    return { ok: true, value: { id, removed: false } };
  }
  // Antes da cascata: a exclusão do backend apaga anotações e documentos ANTES do registro, e
  // recusar depois deixaria a prova sem os anexos dela.
  const editWindow = resolveEditWindow(ctx, collection);
  if (editWindow && !editWindowAllowsDelete(editWindow.spec, existing.createdAt, new Date())) {
    return {
      ok: false,
      error: '@core.automation/mutation.remove.edit-window-closed',
      errorParams: { minutes: String(editWindow.spec.minutes) },
    };
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
