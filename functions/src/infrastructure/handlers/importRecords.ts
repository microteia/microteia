import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import { PERMISSION_RECORD_IMPORT_RUN } from '../../domain/schema/access';
import type { RecordImportRequest } from '../../domain/schema/recordImport';
import {
  makeRecordImportUseCases,
  RecordImportRefusal,
} from '../../domain/usecases/RecordImportUseCases';
import type { RecordImportActor, RecordImportUpsert } from '../../domain/usecases/RecordImportUseCases';
import { FirebaseRecordImportJobRepository } from '../../data/repositories/FirebaseRecordImportJobRepository';
import { FirestoreWorkflowMutationRepository } from '../../data/services/FirestoreWorkflowMutationRepository';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { identifyActor } from '../workflow/identifyActor';
import { runWorkflowUpsert } from '../workflow/mutation/runWorkflowMutation';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';
import { requirePermission } from './shared/requirePermission';

const silent: WorkflowLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * A gravação de uma linha, montada UMA vez por lote: o contexto é o de uma pessoa (`via: 'import'`), que
 * lê com as permissões dela (`memberVisibility`) e responde pela autoria. O resto é o `runWorkflowUpsert`
 * de sempre, com as opções que fazem dele uma importação: casar pela chave `primary`, cobrar a permissão
 * da coleção linha a linha, cobrar o `required` como o formulário cobra e, na simulação, não gravar.
 */
const importUpsertFor = async (tenantId: string, actor: RecordImportActor): Promise<RecordImportUpsert> => {
  const context: WorkflowContext = {
    event: { id: '', tenantId, name: 'record.import', payload: {}, timestamp: new Date() },
    outputs: {},
    variables: {},
    services: {
      logger: silent,
      now: () => new Date(),
      timeZone: await tenantTimeZone(tenantId, actor.userId),
      businessCalendarsOf: tenantBusinessCalendars,
    },
    logger: silent,
    execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
    actor: { ...actor, via: 'import' },
    reader: { uid: actor.userId, permissions: actor.permissions },
    input: {},
  };
  const deps = {
    mutationRepository: new FirestoreWorkflowMutationRepository(getDb()),
    screenProvider: getDI().getScreenDefinitionCache(),
  };
  return async (spec, dryRun) => {
    const outcome = await runWorkflowUpsert(spec, context, deps, {
      matchPrimaryKey: true,
      requireCollectionPermission: true,
      enforceRequired: true,
      dryRun,
    });
    return outcome.ok ? { ok: true, value: { id: outcome.value.id, created: outcome.value.created } } : outcome;
  };
};

const useCases = () => makeRecordImportUseCases({
  jobs: new FirebaseRecordImportJobRepository(getDb()),
  screenProvider: getDI().getScreenDefinitionCache(),
  audit: getDI().getCreateAuditLogUseCase(),
  upsertFor: importUpsertFor,
});

/**
 * A importação em massa de registros de uma tela. Três passos pela mesma porta — abrir (`start`), mandar
 * lotes (`rows`, também na simulação) e fechar (`finish`, que grava a linha de Auditoria) — e todos cobram
 * `record-import.run`; cada linha cobra ainda `<coleção>.create` ou `.update`.
 *
 * O tempo é o de um lote de `RECORD_IMPORT_BATCH_SIZE` linhas, com folga: cada linha é uma gravação
 * completa, e um lote não pode parar no meio por relógio.
 */
export const importRecords = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }
    const data = (request.data ?? {}) as RecordImportRequest;
    if (!data.tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');

    const permissions = await requirePermission(data.tenantId, request.auth, PERMISSION_RECORD_IMPORT_RUN);
    const identity = await identifyActor(request.auth.uid, 'import', permissions);
    const actor: RecordImportActor = {
      userId: identity.userId,
      name: identity.name,
      photoURL: identity.photoURL,
      permissions,
    };

    try {
      switch (data.op) {
        case 'start':
          return await useCases().start({ ...data, actor });
        case 'rows':
          return await useCases().rows({ ...data, dryRun: data.dryRun !== false, actor });
        case 'finish':
          return await useCases().finish({ ...data, cancelled: data.cancelled === true, actor });
        default:
          throw new HttpsError('invalid-argument', '@core.records/import.error.batch-malformed');
      }
    } catch (error) {
      if (error instanceof RecordImportRefusal) {
        throw new HttpsError('failed-precondition', error.message, error.params);
      }
      throw error;
    }
  },
);
