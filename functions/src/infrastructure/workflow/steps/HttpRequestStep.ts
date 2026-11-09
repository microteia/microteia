import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { MapFieldMapping } from '../../../domain/schema/mapSpec';
import {
  buildHttpUrl,
  describeHttpTarget,
  headerValueOf,
  HTTP_REQUEST_STEP_ID,
  HTTP_RESPONSE_MAX_BYTES,
  HTTP_TIMEOUT_DEFAULT_SECONDS,
  HTTP_TIMEOUT_WITHOUT_BUDGET_SECONDS,
  isHttpHostAllowed,
  isHttpPortAllowed,
  queryPairs,
  validateHttpRequestSpec,
  type HttpRequestSpec,
} from '../../../domain/schema/httpRequestSpec';
import { HttpClientError, type HttpIncomingResponse, type HttpOutgoingRequest, type IHttpClient } from '../../../domain/repositories/IHttpClient';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';

/** O que o escritório liberou nas Configurações. Ver `HTTP_SETTINGS_PROPERTIES`. */
export interface HttpPolicy {
  allowedHosts: string[];
  allowedPorts: string[];
}

export interface HttpStepDeps {
  client: IHttpClient;
  policyOf(tenantId: string): Promise<HttpPolicy>;
}

/** Menos que isto não dá para uma chamada de verdade: melhor dizer que o tempo acabou. */
const MIN_USEFUL_TIMEOUT_MS = 1000;

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

const parseBody = (
  response: HttpIncomingResponse,
  responseType: HttpRequestSpec['responseType'],
): { body: unknown } | { invalidJson: true } => {
  const type = responseType ?? 'auto';
  const contentType = response.headers['content-type'] ?? '';
  const wantsJson = type === 'json' || (type === 'auto' && /[/+]json\b/i.test(contentType));
  if (!wantsJson) return { body: response.bodyText };
  if (response.bodyText.trim() === '') return { body: null };
  try {
    return { body: JSON.parse(response.bodyText) as unknown };
  } catch {
    // No `auto`, o servidor que diz JSON e manda outra coisa não derruba o passo: o texto segue como
    // veio. Quem pediu `json` explicitamente pediu a garantia, e recebe a falha.
    return type === 'json' ? { invalidJson: true } : { body: response.bodyText };
  }
};

/** O que o servidor de fora devolve como cabeçalho é dado; cookie de sessão de terceiro não é. */
const publicHeaders = (headers: Record<string, string>): Record<string, string> => {
  const copy = { ...headers };
  delete copy['set-cookie'];
  return copy;
};

const timeoutFor = (spec: HttpRequestSpec, context: WorkflowContext): number => {
  const requested = (spec.timeoutSeconds ?? HTTP_TIMEOUT_DEFAULT_SECONDS) * 1000;
  const deadline = context.services.deadlineAt;
  const available = deadline === undefined
    ? HTTP_TIMEOUT_WITHOUT_BUDGET_SECONDS * 1000
    : deadline - context.services.now().getTime();
  return Math.min(requested, available);
};

const CLIENT_FAILURES: Record<string, string> = {
  timeout: '@core.automation/step.http.timeout',
  'too-large': '@core.automation/step.http.too-large',
  network: '@core.automation/step.http.network',
};

/**
 * Passo "Chamar API (HTTP)". Síncrono: espera a resposta, até o limite do passo e o que resta do
 * orçamento da execução, e a publica como saída para os passos seguintes.
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
      const issues = validateHttpRequestSpec(inputs.request);
      if (issues.length > 0) {
        return { success: false, message: issues[0].error, ...(issues[0].errorParams ? { messageParams: issues[0].errorParams } : {}) };
      }
      const spec = inputs.request as HttpRequestSpec;

      let outgoing: HttpOutgoingRequest;
      try {
        outgoing = prepare(spec, context);
      } catch (error) {
        if (error instanceof StepFailure) return { success: false, message: error.key, ...(error.params ? { messageParams: error.params } : {}) };
        throw error;
      }

      const host = outgoing.url.hostname;
      const target = describeHttpTarget(outgoing.url);
      const policy = await deps.policyOf(context.execution.tenantId);
      if (policy.allowedHosts.length === 0) {
        return { success: false, message: '@core.automation/step.http.no-allowed-hosts' };
      }
      if (!isHttpHostAllowed(host, policy.allowedHosts)) {
        return { success: false, message: '@core.automation/step.http.host-not-allowed', messageParams: { host } };
      }
      if (!isHttpPortAllowed(outgoing.url, policy.allowedPorts)) {
        return { success: false, message: '@core.automation/step.http.port-not-allowed', messageParams: { port: outgoing.url.port } };
      }

      const timeoutMs = timeoutFor(spec, context);
      if (timeoutMs < MIN_USEFUL_TIMEOUT_MS) {
        return { success: false, message: '@core.automation/step.http.no-time-left' };
      }

      const failOnHttpError = spec.failOnHttpError !== false;
      const asOutput = (error: string, params: Record<string, string>, extra: Record<string, unknown> = {}): WorkflowResult =>
        failOnHttpError
          ? { success: false, message: error, messageParams: params }
          : {
              // O passo termina bem — quem decide o que fazer é a Condição seguinte —, mas a linha do
              // histórico diz o que houve, e não "concluído".
              success: true,
              message: error,
              messageParams: params,
              outputs: { ok: false, status: 0, headers: {}, body: null, durationMs: 0, timedOut: false, error, ...extra },
            };

      let response: HttpIncomingResponse;
      try {
        response = await deps.client.send(outgoing, { timeoutMs, maxBytes: HTTP_RESPONSE_MAX_BYTES });
      } catch (error) {
        if (!(error instanceof HttpClientError)) throw error;
        if (error.code === 'address-blocked') {
          return { success: false, message: '@core.automation/step.http.address-blocked', messageParams: { host } };
        }
        const key = CLIENT_FAILURES[error.code];
        const params = {
          target,
          seconds: String(Math.round(timeoutMs / 1000)),
          max: String(Math.round(HTTP_RESPONSE_MAX_BYTES / 1024)),
          detail: error.message,
        };
        return asOutput(key, params, { timedOut: error.code === 'timeout' });
      }

      const parsed = parseBody(response, spec.responseType);
      const ok = response.status >= 200 && response.status < 300;
      const outputs = {
        ok,
        status: response.status,
        headers: publicHeaders(response.headers),
        body: 'body' in parsed ? parsed.body : response.bodyText,
        durationMs: response.durationMs,
        timedOut: false,
        error: null as string | null,
      };
      const ms = String(response.durationMs);
      const status = String(response.status);

      if ('invalidJson' in parsed) {
        if (failOnHttpError) return { success: false, message: '@core.automation/step.http.invalid-json', messageParams: { target } };
        outputs.error = '@core.automation/step.http.invalid-json';
      }
      if (!ok) {
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
    },
  }),
});
