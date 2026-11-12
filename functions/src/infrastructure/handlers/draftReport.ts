import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_REPORTS_MANAGE } from '../../domain/schema/access';
import { AIResponseFormatError } from '../../domain/usecases/CallAIUseCase';
import { REPORT_DRAFT_MAX_DESCRIPTION, draftReportSpec } from '../../domain/services/aiReportDraft';
import type { ReportDraft } from '../../domain/services/aiReportDraft';
import { REPORT_MAX_SCAN } from '../report/reportLimits';

interface DraftReportRequest {
  tenantId: string;
  description?: string;
  /** Só pergunta se há IA para propor — sem chamar o modelo. */
  probe?: boolean;
}

/** A resposta do `probe`: há conexão padrão com chave, ou a REFERÊNCIA do motivo de não haver. */
export interface ReportDraftAvailability {
  available: boolean;
  reason?: string;
}

/**
 * "Descreva o relatório": a IA do escritório propõe um `ReportSpec` sobre as telas dele, e o validador
 * de sempre diz o que achou. Exige `reports.manage` — é autoria —, e não grava nada: o rascunho vai para
 * a tela de autoria, e quem salva é a pessoa.
 */
export const draftReport = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: 120 },
  async (request): Promise<ReportDraft | ReportDraftAvailability> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, description, probe } = (request.data ?? {}) as DraftReportRequest;
    // A tela pergunta ANTES de oferecer o botão: as conexões de IA só são legíveis por quem gerencia a
    // IA, e quem escreve relatórios não precisa — nem deve — enxergá-las para saber que não há uma.
    if (probe === true) {
      if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
      await requirePermission(tenantId, request.auth, PERMISSION_REPORTS_MANAGE);
      try {
        await getDI().getAIConnectionRepository().getDefaultCredentials(tenantId);
        return { available: true };
      } catch (error) {
        const reason = error instanceof Error && error.message.startsWith('@') ? error.message : '@core.automation/ai.no-default-connection';
        return { available: false, reason };
      }
    }
    const text = typeof description === 'string' ? description.trim() : '';
    if (!tenantId || !text) throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    if (text.length > REPORT_DRAFT_MAX_DESCRIPTION) {
      throw new HttpsError('invalid-argument', '@core.reports/draft.too-long', { messageParams: { max: String(REPORT_DRAFT_MAX_DESCRIPTION) } });
    }
    await requirePermission(tenantId, request.auth, PERMISSION_REPORTS_MANAGE);

    const di = getDI();
    try {
      const outcome = await draftReportSpec({
        callAI: di.getCallAIUseCase(),
        credentials: await di.getAIConnectionRepository().getDefaultCredentials(tenantId),
        description: text,
        schema: await di.getScreenDefinitionCache().getSchemaContext(tenantId),
        scanCeiling: REPORT_MAX_SCAN,
      });
      if (!outcome.ok) {
        throw new HttpsError('failed-precondition', outcome.error, { messageParams: { detail: outcome.detail ?? '' } });
      }
      return outcome.draft;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof AIResponseFormatError) {
        throw new HttpsError('internal', error.truncated ? '@core.automation/step.ai.response-truncated' : '@core.automation/step.ai.response-not-json');
      }
      throw new HttpsError('internal', error instanceof Error ? error.message : String(error));
    }
  },
);
