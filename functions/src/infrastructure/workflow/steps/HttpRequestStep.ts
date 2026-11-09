import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import { toPublishedActor } from '../../../domain/engine/workflowActor';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { MapFieldMapping } from '../../../domain/schema/mapSpec';
import {
  buildHttpUrl,
  describeHttpTarget,
  headerValueOf,
  HTTP_ASYNC_REQUEST_MAX_BYTES,
  HTTP_REQUEST_STEP_ID,
  HTTP_RETRIES_DEFAULT,
  HTTP_TIMEOUT_DEFAULT_SECONDS,
  HTTP_TIMEOUT_WITHOUT_BUDGET_SECONDS,
  isAsyncHttpSpec,
  queryPairs,
  validateHttpRequestSpec,
  type HttpRequestSpec,
} from '../../../domain/schema/httpRequestSpec';
import type { HttpOutgoingRequest } from '../../../domain/repositories/IHttpClient';
import type { HttpDispatchCallback, IHttpDispatchQueue } from '../../../domain/repositories/IHttpDispatchRepository';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
import { redactSecrets } from '../../../domain/schema/httpConnection';
import {
  checkHttpBoundary,
  deliverHttp,
  publicHeaders,
  type HttpDeliveryDeps,
  type HttpRefusal,
} from '../../../domain/services/httpDelivery';
import { MAX_CALL_DEPTH } from './CallWorkflowStep';

export type { HttpPolicy } from '../../../domain/services/httpDelivery';

export interface HttpStepDeps extends HttpDeliveryDeps {
  /**
   * A fila do modo assíncrono. Opcional porque nem toda porta que monta o motor sabe enfileirar; sem
   * ela, a chamada assíncrona falha dizendo isso, em vez de virar síncrona sem aviso.
   */
  dispatches?: IHttpDispatchQueue;
}

const PARAM_PREFIX = 'param.';

const DEFAULT_ACCEPT = 'application/json, text/plain;q=0.9, */*;q=0.8';

class StepFailure extends Error {
  constructor(readonly key: string, readonly params?: Record<string, string>) {
    super(key);
  }
}

const resolveField = (field: MapFieldMapping, context: WorkflowContext): unknown => {
  try {
    return resolveMapping(field.value, context);
  } catch (error) {
    throw new StepFailure('@core.automation/step.http.value-failed', {
      name: field.name,
      ...errorParamsOf(error),
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

const resolveValue = (mapping: InputMapping, name: string, context: WorkflowContext): unknown =>
  resolveField({ name, value: mapping }, context);

const named = (fields: MapFieldMapping[] | undefined): MapFieldMapping[] =>
  (fields ?? []).filter((field) => field?.name?.trim()).map((field) => ({ ...field, name: field.name.trim() }));

const serializeJson = (value: unknown): string => JSON.stringify(value === undefined ? null : value);

const buildBody = (
  spec: HttpRequestSpec,
  context: WorkflowContext,
): { body: string; contentType: string } | null => {
  const body = spec.body;
  if (!body || body.kind === 'none') return null;
  switch (body.kind) {
    case 'json':
      return {
        body: serializeJson(buildNestedParams(named(body.fields).map((field) => [field.name, resolveField(field, context)]))),
        contentType: 'application/json',
      };
    case 'json-from':
      return { body: serializeJson(resolveValue(body.value, 'body', context)), contentType: 'application/json' };
    case 'form': {
      const form = new URLSearchParams();
      for (const field of named(body.fields)) {
        for (const [name, value] of queryPairs(field.name, resolveField(field, context))) form.append(name, value);
      }
      return { body: form.toString(), contentType: 'application/x-www-form-urlencoded' };
    }
    case 'text': {
      const value = resolveValue(body.value, 'body', context);
      return { body: value === undefined || value === null ? '' : String(value), contentType: body.contentType.trim() };
    }
    default:
      return null;
  }
};

/** Monta a requisição a partir da especificação. Nada aqui sai pela rede. */
const prepare = (spec: HttpRequestSpec, context: WorkflowContext): HttpOutgoingRequest => {
  const rawUrl = resolveValue(spec.url, 'url', context);
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new StepFailure('@core.automation/step.http.issue.url-missing');
  }
  const pathParams = Object.fromEntries(named(spec.pathParams).map((field) => [field.name, resolveField(field, context)]));
  const query = named(spec.query).flatMap((field) => queryPairs(field.name, resolveField(field, context)));
  const built = buildHttpUrl(rawUrl.trim(), pathParams, query);
  if ('error' in built) throw new StepFailure(built.error, 'errorParams' in built ? built.errorParams : undefined);

  const headers: Record<string, string> = {};
  for (const field of named(spec.headers)) {
    const value = resolveField(field, context);
    if (value === undefined || value === null) continue;
    const checked = headerValueOf(value);
    if ('error' in checked) throw new StepFailure(checked.error, { name: field.name });
    headers[field.name.toLowerCase()] = checked.value;
  }
  headers.accept ??= DEFAULT_ACCEPT;

  const body = buildBody(spec, context);
  if (body) headers['content-type'] ??= body.contentType;

  return { method: spec.method, url: built.url, headers, ...(body ? { body: body.body } : {}) };
};

const timeoutFor = (spec: HttpRequestSpec, context: WorkflowContext): number => {
  const requested = (spec.timeoutSeconds ?? HTTP_TIMEOUT_DEFAULT_SECONDS) * 1000;
  const deadline = context.services.deadlineAt;
  const available = deadline === undefined
    ? HTTP_TIMEOUT_WITHOUT_BUDGET_SECONDS * 1000
    : deadline - context.services.now().getTime();
  return Math.min(requested, available);
};

/**
 * Passo "Chamar API (HTTP)". Síncrono (padrão): espera a resposta, até o limite do passo e o que resta
 * do orçamento da execução, e a publica como saída para os passos seguintes. Assíncrono: confere a
 * fronteira, põe o pedido na fila e segue — ver `enqueue`.
 *
 * Duas famílias de falha, tratadas de jeitos diferentes:
 * - POLÍTICA (domínio fora da lista, porta não liberada, endereço interno, especificação inválida):
 *   falha SEMPRE. `failOnHttpError: false` é sobre o servidor de fora responder mal, nunca sobre
 *   desligar a fronteira do escritório.
 * - RESPOSTA (status fora de 2xx, tempo esgotado, rede, resposta grande demais, JSON inválido): falha
 *   por padrão; com `failOnHttpError: false` vira saída (`ok: false`, `error`, `timedOut`).
 */
export const makeHttpRequestStepDefinition = (deps: HttpStepDeps): StepDefinition => ({
  ...coreStepMetadata(HTTP_REQUEST_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      // As formas do segredo que esta chamada mandou. Tudo o que o passo devolve passa por aqui antes
      // de chegar ao histórico — a resposta pode ecoar o cabeçalho, o erro pode repetir a URL.
      const secretForms: string[] = [];
      const result = await callApi(deps, inputs, context, secretForms);
      return secretForms.length === 0 ? result : redactSecrets(result, secretForms);
    },
  }),
});


const refused = (refusal: HttpRefusal): WorkflowResult => ({
  success: false,
  message: refusal.message,
  ...(refusal.messageParams ? { messageParams: refusal.messageParams } : {}),
});

/** A especificação validada e o pedido montado — ou a recusa, sem nada ter saído pela rede. */
export const prepareHttpCall = (
  value: unknown,
  context: WorkflowContext,
): { spec: HttpRequestSpec; outgoing: HttpOutgoingRequest } | { refused: HttpRefusal } => {
  const issues = validateHttpRequestSpec(value);
  if (issues.length > 0) {
    return { refused: { message: issues[0].error, ...(issues[0].errorParams ? { messageParams: issues[0].errorParams } : {}) } };
  }
  const spec = value as HttpRequestSpec;
  try {
    return { spec, outgoing: prepare(spec, context) };
  } catch (error) {
    if (error instanceof StepFailure) return { refused: { message: error.key, ...(error.params ? { messageParams: error.params } : {}) } };
    throw error;
  }
};

const callApi = async (
  deps: HttpStepDeps,
  inputs: Record<string, unknown>,
  context: WorkflowContext,
  secretForms: string[],
): Promise<WorkflowResult> => {
  const prepared = prepareHttpCall(inputs.request, context);
  if ('refused' in prepared) return refused(prepared.refused);
  const { spec, outgoing } = prepared;

  if (isAsyncHttpSpec(spec)) return enqueue(deps, spec, outgoing, inputs, context);
  if (typeof inputs.targetWorkflowId === 'string' && inputs.targetWorkflowId.trim()) {
    // A resposta já está nas saídas deste passo: o callback só existe para quem não esperou.
    context.logger.warn('@core.automation/step.http.callback-ignored');
  }

  const target = describeHttpTarget(outgoing.url);
  const timeoutMs = timeoutFor(spec, context);
  const outcome = await deliverHttp(
    deps,
    context.execution.tenantId,
    outgoing,
    { ...(spec.connection ? { connection: spec.connection } : {}), responseType: spec.responseType, timeoutMs },
    secretForms,
  );
  if (outcome.kind === 'refused') return refused(outcome.refusal);

  const failOnHttpError = spec.failOnHttpError !== false;
  if (outcome.kind === 'failed') {
    if (failOnHttpError) return { success: false, message: outcome.message, messageParams: outcome.messageParams };
    return {
      // O passo termina bem — quem decide o que fazer é a Condição seguinte —, mas a linha do
      // histórico diz o que houve, e não "concluído".
      success: true,
      message: outcome.message,
      messageParams: outcome.messageParams,
      outputs: {
        ok: false, status: 0, headers: {}, body: null, durationMs: 0,
        timedOut: outcome.failure === 'timeout', error: outcome.message,
      },
    };
  }

  const { response } = outcome;
  const outputs = {
    ok: outcome.ok,
    status: response.status,
    headers: publicHeaders(response.headers),
    body: outcome.body,
    durationMs: response.durationMs,
    timedOut: false,
    error: null as string | null,
  };
  const ms = String(response.durationMs);
  const status = String(response.status);

  if (outcome.invalidJson) {
    if (failOnHttpError) return { success: false, message: '@core.automation/step.http.invalid-json', messageParams: { target } };
    outputs.error = '@core.automation/step.http.invalid-json';
  }
  if (!outcome.ok) {
    if (failOnHttpError) {
      return { success: false, message: '@core.automation/step.http.status-failed', messageParams: { method: outgoing.method, target, status } };
    }
    outputs.error ??= '@core.automation/step.http.status-failed';
  }
  return {
    success: true,
    message: outputs.ok && outputs.error === null ? '@core.automation/step.http.done' : '@core.automation/step.http.done-not-ok',
    messageParams: { method: outgoing.method, target, status, ms },
    outputs,
  };
};

/** Os `param.<chave>` que a automação fixou para o fluxo de callback, resolvidos AGORA. */
const callbackParams = (context: WorkflowContext): Record<string, unknown> => {
  const entries: [string, unknown][] = [];
  for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
    if (!key.startsWith(PARAM_PREFIX)) continue;
    const name = key.slice(PARAM_PREFIX.length);
    entries.push([name, resolveField({ name, value: mapping }, context)]);
  }
  return buildNestedParams(entries);
};

const byteLength = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

/**
 * O modo assíncrono. A FRONTEIRA é conferida aqui, antes de enfileirar: domínio fora da lista,
 * credencial inexistente ou que não vai para este domínio falham o passo NA automação que os causou —
 * descobrir isso numa fila, minutos depois, seria descobrir tarde. A entrega confere de novo, porque a
 * lista e a credencial podem mudar enquanto o pedido espera.
 *
 * O pedido é gravado SEM o segredo: a credencial vai pela chave, e é aplicada a cada tentativa.
 */
const enqueue = async (
  deps: HttpStepDeps,
  spec: HttpRequestSpec,
  outgoing: HttpOutgoingRequest,
  inputs: Record<string, unknown>,
  context: WorkflowContext,
): Promise<WorkflowResult> => {
  if (!deps.dispatches) return { success: false, message: '@core.automation/step.http.async.unavailable' };
  const tenantId = context.execution.tenantId;
  const target = describeHttpTarget(outgoing.url);

  const checked = await checkHttpBoundary(deps, tenantId, outgoing, spec.connection || undefined);
  if ('refused' in checked) return refused(checked.refused);

  let callback: HttpDispatchCallback | undefined;
  const callbackId = typeof inputs.targetWorkflowId === 'string' ? inputs.targetWorkflowId.trim() : '';
  if (callbackId) {
    const depth = Number(context.event.payload.__callDepth ?? 0);
    if (depth >= MAX_CALL_DEPTH) {
      return { success: false, message: '@core.automation/step.call-workflow.max-depth', messageParams: { max: String(MAX_CALL_DEPTH) } };
    }
    try {
      callback = { workflowId: callbackId, params: callbackParams(context), callDepth: depth + 1 };
    } catch (error) {
      if (error instanceof StepFailure) return refused({ message: error.key, ...(error.params ? { messageParams: error.params } : {}) });
      throw error;
    }
  }

  const request = {
    method: spec.method,
    url: outgoing.url.toString(),
    headers: outgoing.headers,
    ...(outgoing.body !== undefined ? { body: outgoing.body } : {}),
  };
  if (byteLength({ request, callback }) > HTTP_ASYNC_REQUEST_MAX_BYTES) {
    return {
      success: false,
      message: '@core.automation/step.http.async.too-large',
      messageParams: { max: String(Math.round(HTTP_ASYNC_REQUEST_MAX_BYTES / 1024)) },
    };
  }

  const dispatchId = await deps.dispatches.enqueue(tenantId, {
    request,
    ...(spec.connection ? { connection: spec.connection } : {}),
    ...(spec.responseType ? { responseType: spec.responseType } : {}),
    timeoutSeconds: spec.timeoutSeconds ?? HTTP_TIMEOUT_DEFAULT_SECONDS,
    maxAttempts: 1 + (spec.retries ?? HTTP_RETRIES_DEFAULT),
    ...(callback ? { callback } : {}),
    ...(context.actor ? { actor: toPublishedActor(context.actor) } : {}),
    origin: { workflowId: context.execution.workflowDefinitionId, executionId: context.execution.id },
  }, context.services.now());

  return {
    success: true,
    message: '@core.automation/step.http.queued',
    messageParams: { method: outgoing.method, target },
    outputs: { dispatchId },
  };
};
