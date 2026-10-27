import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import { detectWorkflowIds, eligibleCandidates } from '../../domain/services/aiWorkflowDetection';
import type { WorkflowDetectionCandidate } from '../../domain/services/aiWorkflowDetection';

interface DetectWorkflowsRequest {
  tenantId: string;
  connectionId: string;
  text: string;
  workflows: WorkflowDetectionCandidate[];
}

export const detectWorkflows = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, connectionId, text, workflows } = request.data as DetectWorkflowsRequest;

    if (!tenantId || !connectionId || !text || !Array.isArray(workflows)) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    const eligible = eligibleCandidates(workflows);
    if (eligible.length === 0) {
      return { orderedWorkflowIds: [] as string[] };
    }

    try {
      const di = getDI();
      await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_MANAGE);

      const credentials = await di.getAIConnectionRepository().getCredentialsById(tenantId, connectionId);

      const orderedWorkflowIds = await detectWorkflowIds({
        callAI: di.getCallAIUseCase(),
        credentials,
        text,
        candidates: eligible,
      });

      return { orderedWorkflowIds };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : '@core.admin/processor.detect-failed';
      throw new HttpsError('internal', message);
    }
  },
);
