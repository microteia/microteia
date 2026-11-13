import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAnyPermission } from './shared/requirePermission';
import { PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL } from '../../domain/schema/access';
import { REPORT_DRAFT_MAX_DESCRIPTION } from '../../domain/services/aiReportDraft';
import type { ReportDraft } from '../../domain/services/aiReportDraft';
import { draftReportForTenant, reportDraftAvailability } from '../report/draftReportForTenant';

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
 * de sempre diz o que achou. Exige `reports.manage` ou `reports.personal` — é autoria —, e não grava nada: o rascunho vai para
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
      await requireAnyPermission(tenantId, request.auth, [PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL]);
      return reportDraftAvailability(tenantId);
    }
    const text = typeof description === 'string' ? description.trim() : '';
    if (!tenantId || !text) throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    if (text.length > REPORT_DRAFT_MAX_DESCRIPTION) {
      throw new HttpsError('invalid-argument', '@core.reports/draft.too-long', { messageParams: { max: String(REPORT_DRAFT_MAX_DESCRIPTION) } });
    }
    await requireAnyPermission(tenantId, request.auth, [PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL]);

    const outcome = await draftReportForTenant(tenantId, text);
    if (outcome.ok) return outcome.draft;
    throw new HttpsError(outcome.kind === 'refused' ? 'failed-precondition' : 'internal', outcome.error, {
      messageParams: outcome.errorParams ?? {},
    });
  },
);
