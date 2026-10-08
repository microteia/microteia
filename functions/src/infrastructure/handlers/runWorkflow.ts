import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { toPublishedActor } from '../../domain/engine/workflowActor';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access';
import { getDb } from '../firebase/initFirebase';
import { publishEvent } from '../workflow/publishEvent';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import { describeRuleIssues } from '../../domain/schema/fieldRules';
import { formatAndValidateParameters } from '../../domain/schema/parameterRules';
import { AIResponseFormatError } from '../../domain/usecases/CallAIUseCase';
import {
  AIExtractionRefusedError,
  buildSchemaForPrompt,
  extractParameterValues,
  hasEntityReferenceDeep,
  resolveParameters,
} from '../../domain/services/aiParameterExtraction';

interface RunWorkflowRequest {
  tenantId: string;
  connectionId?: string;
  targetWorkflowId: string;
  text?: string;
  providedParams?: Record<string, unknown>;
}

const AI_FAILURE_USER_MESSAGE =
  '@core.admin/processor.ai-failed';

const HEAD_CHARS = 2000;
const TAIL_CHARS = 2000;

const headTail = (value: string, headMax: number, tailMax: number): string => {
  const text = value.trim();
  if (text.length <= headMax + tailMax) return text;
  const omitted = text.length - headMax - tailMax;
  return `${text.slice(0, headMax)}\n\n… (${omitted} caracteres omitidos no meio) …\n\n${text.slice(-tailMax)}`;
};

const logAIFillFailure = async (
  tenantId: string,
  userId: string,
  userName: string,
  photoURL: string,
  targetWorkflowId: string,
  /** REFERÊNCIA da causa; `diagnosisParams` traz o que ela interpola. */
  diagnosis: string,
  diagnosisParams: Record<string, string>,
  schemaJson: string,
  rawResponse: string,
): Promise<void> => {
  try {
    await getDI().getCreateAuditLogUseCase().execute({
      tenantId,
      title: '@core.admin/processor.ai-parse-failed.title',
      userId,
      userName,
      photoURL,
      action: 'SYSTEM',
      severity: 'CRITICAL',
      type: 'ERROR',
      entity: 'Workflow',
      entityId: targetWorkflowId,
      text: '@core.admin/processor.ai-parse-failed.text',
      textParams: {
        // Os parâmetros da CAUSA sobem para o mesmo objeto: `{diagnosis}` é ele próprio uma
        // referência, e `resolveParam` os passa adiante ao resolvê-la.
        ...diagnosisParams,
        diagnosis,
        schema: schemaJson,
        response: headTail(rawResponse, HEAD_CHARS, TAIL_CHARS),
      },
    });
  } catch (loggingError) {
    console.error('[runWorkflow] Falha ao registrar auditoria de erro da IA:', loggingError);
  }
};

export const runWorkflow = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, connectionId, targetWorkflowId, text, providedParams } =
      request.data as RunWorkflowRequest;

    if (!tenantId || !targetWorkflowId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    try {
      const di = getDI();
      // Sem PERMISSÕES no evento, de propósito: esta porta PUBLICA um evento, e a execução acontece
      // depois, noutra invocação. Levar as permissões seria persistir um retrato do acesso de alguém
      // — que envelhece — dentro do barramento. `hasPermission(...)` responde NÃO aqui, e o gesto
      // síncrono que precisa dele é a Action (`runAction`), que roda em processo. A IDENTIDADE vai:
      // quem pediu a execução é um fato, e é o autor do que o fluxo gravar.
      const actorPermissions = await requirePermission(tenantId, request.auth.uid, PERMISSION_AUTOMATION_RUN);

      const definition = await di.getWorkflowDefinitionRepository().findByRef(tenantId, targetWorkflowId);
      if (!definition) {
        throw new HttpsError('not-found', '@core.admin/processor.workflow-not-found');
      }
      if (definition.eventName !== WORKFLOW_CALLED_EVENT) {
        throw new HttpsError(
          'failed-precondition',
          '@core.admin/processor.workflow-not-callable',
        );
      }

      const params = definition.parameters ?? [];
      if (hasEntityReferenceDeep(params)) {
        throw new HttpsError(
          'failed-precondition',
          '@core.admin/processor.workflow-has-references',
        );
      }

      let values: Record<string, unknown> = {};

      if (text && text.trim() && params.length > 0) {
        if (!connectionId) {
          throw new HttpsError('invalid-argument', '@core.admin/processor.ai.none-selected');
        }
        const credentials = await di.getAIConnectionRepository().getCredentialsById(tenantId, connectionId);
        const schemaJson = buildSchemaForPrompt(params);
        const auth = request.auth;
        const reportFailure = async (
          diagnosis: string,
          diagnosisParams: Record<string, string>,
          rawResponse: string,
        ): Promise<never> => {
          await logAIFillFailure(
            tenantId,
            auth.uid,
            (auth.token.name as string | undefined) ?? '@core.workspace/user.anonymous',
            (auth.token.picture as string | undefined) ?? '',
            targetWorkflowId,
            diagnosis,
            diagnosisParams,
            schemaJson,
            rawResponse,
          );
          throw new HttpsError('internal', AI_FAILURE_USER_MESSAGE);
        };

        try {
          values = await extractParameterValues({
            callAI: di.getCallAIUseCase(),
            credentials,
            text,
            parameters: params,
          });
        } catch (aiErr) {
          if (aiErr instanceof AIExtractionRefusedError) {
            await reportFailure(
              '@core.admin/processor.ai-said-failed',
              { detail: aiErr.detail },
              aiErr.raw,
            );
          }
          if (aiErr instanceof AIResponseFormatError) {
            const diagnosis = aiErr.truncated
              ? '@core.admin/processor.ai-truncated'
              : '@core.admin/processor.ai-not-json';
            const diagnosisParams: Record<string, string> = aiErr.truncated
              ? { limit: String(credentials.maxTokens) }
              : {};
            await reportFailure(diagnosis, diagnosisParams, aiErr.raw);
          }
          throw aiErr;
        }
      }

      const resolvedParams = resolveParameters(params, providedParams, values);

      const ruled = formatAndValidateParameters(params, resolvedParams);
      if (ruled.issues.length > 0) {
        throw new HttpsError('invalid-argument', describeRuleIssues(ruled.issues));
      }

      const eventId = await publishEvent(getDb(), tenantId, WORKFLOW_CALLED_EVENT, {
        __targetWorkflowId: targetWorkflowId,
        __callDepth: 1,
        ...ruled.data,
      }, toPublishedActor(await identifyActor(request.auth.uid, 'ui', actorPermissions)));

      return { eventId };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : '@core.admin/processor.run-failed';
      throw new HttpsError('internal', message);
    }
  },
);
