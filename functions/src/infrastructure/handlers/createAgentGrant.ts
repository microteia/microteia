import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { issueAgentGrant } from '../agent/issueAgentGrant';

const REGION = 'southamerica-east1';

interface CreateAgentGrantRequest {
  tenantId: string;
  name: string;
  permissions: string[];
  /** Ausente ou nulo = sem expiração. A revogação continua sendo o caminho garantido. */
  expiresInDays?: number | null;
}

interface CreateAgentGrantResponse {
  grantId: string;
  /**
   * O token EM CLARO, e esta é a única vez que ele existe fora da máquina de quem o pediu: o
   * Firestore guarda apenas o hash. Perdido, não há recuperação — emite-se outro.
   */
  token: string;
}

/**
 * A emissão pela TELA. Toda a conferência vive em `issueAgentGrant`, porque o consentimento de OAuth
 * emite pelo mesmo lugar — e uma segunda cópia das regras é uma que envelhece sozinha.
 */
export const createAgentGrant = onCall(
  { region: REGION, cors: true },
  async (request): Promise<CreateAgentGrantResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, name, permissions, expiresInDays } = request.data as CreateAgentGrantRequest;
    return issueAgentGrant({
      tenantId,
      userId: request.auth.uid,
      session: request.auth.token,
      name,
      permissions,
      expiresInDays,
      origin: 'manual',
    });
  },
);
