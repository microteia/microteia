import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

interface CallAIRequest {
  tenantId: string;
  iaQuestion: string;
}

export const callAIProxy = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, iaQuestion } = request.data as CallAIRequest;

    if (!tenantId || !iaQuestion) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    try {
      const di = getDI();
      const getCredsUC = di.getDefaultAICredentialsUseCase();
      const callAIUC = di.getCallAIAnalysisUseCase();

      const credentials = await getCredsUC.execute(tenantId, request.auth.uid);
      const analysis = await callAIUC.execute(credentials, iaQuestion);

      return { analysis };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : '@core.tenant/ai.call-failed';
      throw new HttpsError('internal', message);
    }
  },
);
