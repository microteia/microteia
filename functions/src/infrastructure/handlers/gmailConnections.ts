import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getDI } from '../di/container';
import { GMAIL_READONLY_SCOPE } from '../../domain/entities/GmailConnection';
import { domainErrorCode } from '../../domain/errors/DomainError';

const googleClientId = defineString('GOOGLE_CLIENT_ID');

/**
 * As contas Gmail autorizadas do escritório, mais o que a tela precisa para autorizar uma nova: o
 * id do cliente OAuth e o escopo pedido.
 *
 * Os três na MESMA resposta porque são uma coisa só do ponto de vista de quem abre a tela — e
 * porque o id do cliente é do backend, onde a credencial já vive. A tela da extensão não guarda
 * configuração de Google em lugar nenhum.
 */
export const listGmailConnections = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId } = (request.data ?? {}) as { tenantId?: string };

    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    try {
      const connections = await getDI()
        .getGetGmailConnectionsUseCase()
        .execute(tenantId, request.auth.uid);

      return {
        connections: connections.map((connection) => ({
          id: connection.id,
          email: connection.email,
          authorizedByName: connection.authorizedByName,
          authorizedAt: connection.authorizedAt.toISOString(),
          expiration: connection.expiration ?? null,
        })),
        clientId: googleClientId.value(),
        scope: GMAIL_READONLY_SCOPE,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '@core.workspace/gmail.list-failed';
      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);

export const revokeGmailConnection = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, connectionId } = (request.data ?? {}) as {
      tenantId?: string;
      connectionId?: string;
    };

    if (!tenantId || !connectionId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    try {
      await getDI().getRevokeGmailConnectionUseCase().execute(tenantId, request.auth.uid, connectionId);
      return { revoked: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : '@core.workspace/gmail.revoke-failed';
      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
