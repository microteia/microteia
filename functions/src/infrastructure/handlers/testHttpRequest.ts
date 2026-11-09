import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import {
  httpDynamicValues,
  HTTP_TEST_TIMEOUT_SECONDS,
  HTTP_TIMEOUT_DEFAULT_SECONDS,
  type HttpRequestSpec,
  type HttpTestResult,
} from '../../domain/schema/httpRequestSpec';
import { redactSecrets } from '../../domain/schema/httpConnection';
import { deliverHttp, publicHeaders } from '../../domain/services/httpDelivery';
import { prepareHttpCall } from '../workflow/steps/HttpRequestStep';

const SILENT: WorkflowLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

/** O teste não tem execução: só valores fixos, e o contexto existe para a montagem não precisar de outro caminho. */
const testContext = (tenantId: string): WorkflowContext => {
  const now = new Date();
  return {
    event: { id: 'http-test', tenantId, name: 'http.test', payload: {}, timestamp: now },
    outputs: {},
    variables: {},
    services: { logger: SILENT, now: () => new Date() },
    logger: SILENT,
    execution: { id: 'http-test', workflowDefinitionId: '', tenantId },
  };
};

const failure = (error: string, errorParams?: Record<string, string>): HttpTestResult => ({
  ok: false, status: 0, headers: {}, body: null, durationMs: 0, timedOut: false, error,
  ...(errorParams ? { errorParams } : {}),
});

/**
 * "Testar chamada", no editor do passo. Faz UMA chamada de verdade, pela MESMA montagem e pela MESMA
 * fronteira do passo — lista de domínios, portas, credencial e a redação do segredo. Um teste que
 * passasse por outro caminho provaria outra coisa.
 *
 * Pede `automation.manage`: quem testa é quem edita automações, e o teste envia dados para fora como
 * a automação enviaria. Os valores dinâmicos chegam já trocados pelos exemplos que a pessoa digitou —
 * um mapping que não é fixo é recusado, porque aqui não há evento nem passo anterior para resolvê-lo.
 */
export const testHttpRequest = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: HTTP_TEST_TIMEOUT_SECONDS + 15 },
  async (request): Promise<HttpTestResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const data = (request.data ?? {}) as { tenantId?: unknown; request?: unknown };
    const tenantId = typeof data.tenantId === 'string' ? data.tenantId.trim() : '';
    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_MANAGE);

    const context = testContext(tenantId);
    const prepared = prepareHttpCall(data.request, context);
    if ('refused' in prepared) return failure(prepared.refused.message, prepared.refused.messageParams);
    if (httpDynamicValues(prepared.spec).length > 0) return failure('@core.automation/step.http.test.dynamic');

    const spec: HttpRequestSpec = prepared.spec;
    const secretForms: string[] = [];
    const outcome = await deliverHttp(
      getDI().getHttpDeliveryDeps(),
      tenantId,
      prepared.outgoing,
      {
        ...(spec.connection ? { connection: spec.connection } : {}),
        ...(spec.responseType ? { responseType: spec.responseType } : {}),
        timeoutMs: Math.min(spec.timeoutSeconds ?? HTTP_TIMEOUT_DEFAULT_SECONDS, HTTP_TEST_TIMEOUT_SECONDS) * 1000,
      },
      secretForms,
    );

    const result: HttpTestResult = outcome.kind === 'refused'
      ? failure(outcome.refusal.message, outcome.refusal.messageParams)
      : outcome.kind === 'failed'
        ? { ...failure(outcome.message, outcome.messageParams), timedOut: outcome.failure === 'timeout' }
        : {
            ok: outcome.ok && !outcome.invalidJson,
            status: outcome.response.status,
            headers: publicHeaders(outcome.response.headers),
            body: outcome.body,
            durationMs: outcome.response.durationMs,
            timedOut: false,
            error: outcome.invalidJson
              ? '@core.automation/step.http.invalid-json'
              : outcome.ok ? null : '@core.automation/step.http.test.status',
            ...(outcome.ok || outcome.invalidJson ? {} : { errorParams: { status: String(outcome.response.status) } }),
          };
    return secretForms.length === 0 ? result : redactSecrets(result, secretForms);
  },
);
