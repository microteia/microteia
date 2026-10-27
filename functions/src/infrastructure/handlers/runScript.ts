import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access';
import { getDb } from '../firebase/initFirebase';
import { applyParameterDefaults } from '../../domain/schema/eventCatalog';
import { ruleIssueParams } from '../../domain/schema/fieldRules';
import { formatAndValidateParameters } from '../../domain/schema/parameterRules';
import { parseDateOnly } from '../../domain/schema/mutationSpec';
import { runScriptSandbox } from '../workflow/sandbox/runScriptSandbox';
import { FirestoreWorkflowQueryRepository } from '../../data/services/FirestoreWorkflowQueryRepository';
import { FirestoreWorkflowRecordFetcher } from '../../data/services/FirestoreWorkflowRecordFetcher';
import { FirestoreWorkflowMutationRepository } from '../../data/services/FirestoreWorkflowMutationRepository';
import type { WorkflowQueryDeps } from '../workflow/query/runWorkflowQuery';
import type { WorkflowMutationDeps } from '../workflow/mutation/runWorkflowMutation';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { WorkflowParameter } from '../../domain/entities/Workflow';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { mentionsBusinessDays } from '../../domain/schema/time/businessDays';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';

interface RunScriptRequest {
  tenantId: string;
  compiledJs: string;
  inputParams?: WorkflowParameter[];
  providedParams?: Record<string, unknown>;
}

interface RunScriptLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const coerceScalar = (param: WorkflowParameter, value: unknown): unknown => {
  if (value === null || value === undefined || value === '') return value;
  switch (param.type) {
    case 'Number': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : value;
    }
    case 'Boolean': {
      if (typeof value === 'boolean') return value;
      return ['true', '1', 'sim', 'yes'].includes(String(value).trim().toLowerCase());
    }
    case 'Date': {
      if (value instanceof Date) return value;
      const dayOnly = parseDateOnly(String(value));
      if (dayOnly) return dayOnly;
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? value : d;
    }
    default:
      return value;
  }
};

const coerceValue = (param: WorkflowParameter, value: unknown): unknown => {
  if (param.type === 'Object') {
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const field of param.fields ?? []) {
      if (field.key in value) out[field.key] = coerceParam(field, value[field.key]);
    }
    return out;
  }
  return coerceScalar(param, value);
};

const coerceParam = (param: WorkflowParameter, value: unknown): unknown =>
  param.list && Array.isArray(value) ? value.map((item) => coerceValue(param, item)) : coerceValue(param, value);

const coerceProvidedParams = (
  params: WorkflowParameter[],
  provided: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...provided };
  for (const param of params) {
    if (param.key in out) out[param.key] = coerceParam(param, out[param.key]);
  }
  return out;
};

export const runScript = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, compiledJs, inputParams, providedParams } = request.data as RunScriptRequest;

    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }
    if (!compiledJs || !compiledJs.trim()) {
      throw new HttpsError('invalid-argument', '@core.automation/script.error.empty');
    }

    const di = getDI();
    const actorPermissions = await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_RUN);

    const params = inputParams ?? [];
    const coerced = coerceProvidedParams(params, providedParams ?? {});
    const ruled = formatAndValidateParameters(params, applyParameterDefaults(params, coerced));
    if (ruled.issues.length > 0) {
      throw new HttpsError(
        'invalid-argument',
        '@core.automation/handler.script.invalid-params',
        { messageParams: ruleIssueParams(ruled.issues) },
      );
    }

    const db = getDb();
    const queryDeps: WorkflowQueryDeps = {
      queryRepository: new FirestoreWorkflowQueryRepository(db),
      fetcher: new FirestoreWorkflowRecordFetcher(db),
      screenProvider: di.getScreenDefinitionCache(),
    };
    const mutationDeps: WorkflowMutationDeps = {
      mutationRepository: new FirestoreWorkflowMutationRepository(db),
      screenProvider: di.getScreenDefinitionCache(),
    };

    const logs: RunScriptLogEntry[] = [];
    const logger: WorkflowLogger = {
      info: (message) => logs.push({ level: 'INFO', message }),
      warn: (message) => logs.push({ level: 'WARN', message }),
      error: (message) => logs.push({ level: 'ERROR', message }),
    };

    const context: WorkflowContext = {
      event: { id: '', tenantId, name: 'script.debug', payload: {}, timestamp: new Date() },
      outputs: {},
      variables: {},
      services: {
        logger,
        now: () => new Date(),
        timeZone: await tenantTimeZone(tenantId, request.auth.uid),
        businessCalendarsOf: tenantBusinessCalendars,
        ...(mentionsBusinessDays(compiledJs) ? { businessCalendars: await tenantBusinessCalendars(tenantId) } : {}),
      },
      logger,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
      actor: await identifyActor(request.auth.uid, 'ui', actorPermissions),
      input: ruled.data,
    };

    try {
      const outputs = await runScriptSandbox(compiledJs, ruled.data, context, queryDeps, mutationDeps);
      return { outputs, logs, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { outputs: null, logs, error: message };
    }
  },
);
