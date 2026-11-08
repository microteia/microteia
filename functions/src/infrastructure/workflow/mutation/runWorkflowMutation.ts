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
import { collectDerivedFieldKeys, formatAndValidateRecord, seedFieldDefaults, tableMentionsBusinessDays } from '../../../domain/schema/recordRules';
import { isEmptyRuleValue } from '../../../domain/schema/fieldRulePresets';
import { withAmbientTimeZone } from '../../../domain/schema/clockGate';
import { withAmbientBusinessCalendars } from '../../../domain/schema/time/businessDaysGate';
import { businessCalendarsFor } from '../../../domain/services/businessCalendarScope';
import {
  diffRecordKeys,
  planRecordKeys,
  RECORD_KEY_REFS_FIELD,
  storedRecordKeyRefs,
} from '../../../domain/schema/recordKeys';
import { resolveEntity, resolveRecordKeys, resolveRecordSequences } from '../../../domain/schema/screenEntity';
import type { RecordSequenceEntry } from '../../../domain/schema/recordSequence';
import { omitSequenceFields, planRecordSequences } from '../../../domain/schema/recordSequence';
import { DEFAULT_TIME_ZONE } from '../../../domain/schema/i18n/timeZone';
import {
  changedRecordKeys,
  editWindowAllowsDelete,
  editWindowAllowsUpdate,
  resolveEditWindow,
} from '../../../domain/schema/editWindow';
import { readerSeesRecord, resolveMemberVisibility } from '../../../domain/schema/memberVisibility';
import { RecordKeyTakenError } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { RecordKeyMutation } from '../../../domain/repositories/IWorkflowMutationRepository';
import { collectionPermissionId } from '../../../domain/schema/access/permission';
import { grants } from '../../../domain/schema/access/memberPermissions';
import type { SchemaContext } from '../../../domain/schema/pathResolver';

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
  /**
   * Sem `id`, procura o registro pela chave `primary` da coleção: achado, ALTERA; não achado, cria. É o
   * que torna a mesma gravação repetível — a importação reprocessada não duplica. A chave é calculada
   * sobre o valor já FORMATADO pelas regras do campo, o mesmo que a reserva guardou. Coleção sem chave
   * `primary`, ou linha sem o valor dela, segue o caminho de sempre.
   */
  matchPrimaryKey?: boolean;
  /**
   * Confere TUDO o que a gravação conferiria — campos, regras, chaves (inclusive a ocupada por outro
   * registro), janela de edição, permissão — e não grava nada. A sequência não é atribuída: o número
   * só existe quando o registro existe.
   */
  dryRun?: boolean;
  /**
   * Cobra do ator `<coleção>.create` ou `<coleção>.update`, conforme o que a gravação VAI fazer — o que
   * só se sabe depois de achar (ou não) o registro. Sem ator, recusa: a porta que pede isto responde
   * por uma pessoa.
   */
  requireCollectionPermission?: boolean;
  /**
   * Cobra o `required` dos campos sobre o registro INTEIRO (o gravado mais o que chega) — a mesma conta
   * do formulário. Fora disto o `upsert` não o cobra, de propósito: a automação grava o que o fluxo
   * decidiu, às vezes em etapas. Não vale para o número sequencial (atribuído depois), nem para o campo
   * agregado ou derivado, que ninguém escreve.
   */
  enforceRequired?: boolean;
  /**
   * Na CRIAÇÃO, o campo que o pedido não traz nasce com o `defaultValue` declarado, como no formulário
   * (`seedFieldDefaults`). Fora disto o `upsert` grava só o que recebeu — de propósito: a automação que
   * sempre gravou sem o padrão não passa a gravá-lo. Alterar não semeia nada.
   */
  seedDefaults?: boolean;
  /**
   * A gravação fica presa a UM registro-pai: o campo recebe o id antes de tudo — formatação, chaves,
   * casamento pela `primary` —, e o registro achado que não aponta para esse pai (outro pai, ou nenhum)
   * é recusado em vez de alterado. Sem isto, uma chave que não inclui o pai moveria em silêncio o
   * registro de outro pai para este. Quem pede é a importação feita na aba do pai.
   */
  lockedTo?: { fieldKey: string; recordId: string };
}

const pointsTo = (value: unknown, recordId: string): boolean =>
  Array.isArray(value) ? value.includes(recordId) : value === recordId;

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

/**
 * O registro que a chave `primary` endereça, pelo valor que a linha traz. A primeira passada das regras
 * serve só para FORMATAR a chave (a reserva guarda o valor formatado); o que ela recusa não importa aqui —
 * a passada de verdade, sobre o registro achado, é a que responde.
 */
const findByPrimaryKey = async (
  ctx: SchemaContext,
  table: string,
  collection: string,
  data: Record<string, unknown>,
  tenantId: string,
  deps: WorkflowMutationDeps,
  ambient: <T>(run: () => T) => T,
): Promise<string | null> => {
  const primary = resolveRecordKeys(ctx, collection).find((key) => key.kind === 'primary');
  if (!primary) return null;
  const formatted = ambient(() => formatAndValidateRecord(ctx, table, data)).data;
  const [entry] = planRecordKeys([primary], formatted, collection, ctx.fieldRulePresets).entries;
  if (!entry) return null;
  return (await deps.mutationRepository.findKeyHolders(tenantId, [entry.keyId])).get(entry.keyId) ?? null;
};

const missingRequiredField = (
  ctx: SchemaContext,
  table: string,
  collection: string,
  record: Record<string, unknown>,
  numbered: readonly { key: string }[],
): string | null => {
  const skipped = new Set([...collectDerivedFieldKeys(ctx, table), ...numbered.map((entry) => entry.key)]);
  const field = (resolveEntity(ctx, collection)?.fields ?? []).find((spec) =>
    spec.required && !spec.aggregation && !skipped.has(spec.key) && isEmptyRuleValue(record[spec.key]));
  return field ? (field.label || field.key) : null;
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

  let effectiveSpec: UpsertSpec = options.lockedTo
    ? { ...spec, data: { ...spec.data, [options.lockedTo.fieldKey]: options.lockedTo.recordId } }
    : spec;
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

  const calendars = await businessCalendarsFor(
    context.services,
    tenantId,
    tableMentionsBusinessDays(ctx, effectiveSpec.table),
  );
  const ambient = <T>(run: () => T): T =>
    withAmbientBusinessCalendars(calendars, () => withAmbientTimeZone(context.services.timeZone, run));

  // O registro existente é lido ANTES das regras: ele é a base do escopo dos campos computados,
  // sem a qual um update parcial recalcularia com as dependências ausentes do payload.
  let id = effectiveSpec.id?.trim();
  let existing = id ? await deps.mutationRepository.getById(tenantId, collection, id) : null;
  if (!id && options.matchPrimaryKey) {
    // A reserva sem registro vivo atrás (resto de uma gravação interrompida) não endereça nada: a
    // linha cria, e a reserva ocupada a recusa como a qualquer outra gravação.
    const holder = await findByPrimaryKey(ctx, effectiveSpec.table, collection, effectiveSpec.data, tenantId, deps, ambient);
    existing = holder ? await deps.mutationRepository.getById(tenantId, collection, holder) : null;
    if (existing) id = holder ?? undefined;
  }
  if (options.updateOnly && !existing) {
    return { ok: false, error: '@core.automation/mutation.upsert.not-found' };
  }
  // A pessoa por quem se grava (o agente) não altera o registro que não vê (`memberVisibility`) — como
  // na regra do Firestore. A recusa é a de quem não existe; criar continua livre, e pode nomear outra
  // pessoa. A automação não tem leitor e grava como sempre.
  if (existing && !readerSeesRecord(resolveMemberVisibility(ctx, collection), collection, context.reader, existing)) {
    return { ok: false, error: '@core.records/record.not-found' };
  }
  if (existing && options.lockedTo && !pointsTo(existing[options.lockedTo.fieldKey], options.lockedTo.recordId)) {
    return { ok: false, error: '@core.automation/mutation.upsert.outside-parent' };
  }
  if (options.requireCollectionPermission) {
    const permission = collectionPermissionId(collection, existing ? 'update' : 'create');
    if (!grants(context.actor?.permissions ?? [], permission)) {
      return { ok: false, error: '@core.access/permission.denied', errorParams: { permission } };
    }
  }

  // Semeado ANTES das regras: o padrão passa pela coerção, pela máscara e pela validação como o valor
  // digitado, e o `compute` que depende dele o enxerga.
  const incoming = options.seedDefaults && !existing
    ? seedFieldDefaults(ctx, effectiveSpec.table, effectiveSpec.data)
    : effectiveSpec.data;
  const ruled = ambient(() =>
    formatAndValidateRecord(ctx, effectiveSpec.table, incoming, {
      baseline: existing ?? undefined,
    }),
  );
  if (ruled.issues.length > 0) {
    return {
      ok: false,
      error: '@core.automation/mutation.upsert.invalid',
      errorParams: ruleIssueParams(ruled.issues),
    };
  }
  const ruledSpec: UpsertSpec = { ...effectiveSpec, data: ruled.data };

  // O número sequencial nunca vem de quem grava: `validateUpsertSpec` já recusou o campo, e um
  // `compute` que o produzisse também não passa daqui. Ele é atribuído abaixo, só na criação.
  const numbered = resolveRecordSequences(ctx, collection);
  const payload = omitSequenceFields(buildFieldPayload(ruledSpec, target, ctx), numbered);

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
  const declaredKeys = resolveRecordKeys(ctx, collection);
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

  // A sequência é planejada aqui e ATRIBUÍDA na transação do repositório, junto com o registro: só
  // ali o contador é lido e avançado sem que outra criação passe no meio.
  let sequences: RecordSequenceEntry[] = [];
  if (!(id && existing) && numbered.length > 0) {
    const numbering = planRecordSequences(
      numbered,
      payload,
      collection,
      context.services.now(),
      context.services.timeZone ?? DEFAULT_TIME_ZONE,
    );
    if (numbering.gaps.length > 0) {
      return {
        ok: false,
        error: '@core.automation/mutation.upsert.sequence-parent-required',
        errorParams: { field: numbering.gaps[0].field, parent: numbering.gaps[0].parentField },
      };
    }
    sequences = numbering.entries;
  }

  if (options.enforceRequired) {
    const missing = missingRequiredField(ctx, effectiveSpec.table, collection, { ...(existing ?? {}), ...payload }, numbered);
    if (missing) {
      // O RÓTULO, e não a chave: referência ou texto do escritório, o catálogo resolve o parâmetro.
      return { ok: false, error: '@core.automation/mutation.upsert.required', errorParams: { field: missing } };
    }
  }

  if (options.dryRun) {
    // A reserva que a gravação tentaria criar, já de OUTRO registro, é a recusa que o `tx.create` daria.
    const wanted = keyMutation?.create ?? [];
    const holders = await deps.mutationRepository.findKeyHolders(tenantId, wanted.map((entry) => entry.keyId));
    const taken = wanted.find((entry) => {
      const holder = holders.get(entry.keyId);
      return holder !== undefined && holder !== id;
    });
    if (taken) {
      return {
        ok: false,
        error: '@core.automation/mutation.upsert.key-conflict',
        errorParams: { key: taken.keyName, value: taken.values.join(' + ') },
      };
    }
    const updating = Boolean(id && existing);
    return {
      ok: true,
      value: { id: updating ? (id as string) : '', created: !updating, record: { ...(existing ?? {}), ...withKeys } },
    };
  }

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
        sequences,
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
