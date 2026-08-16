import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getDI } from '../di/container';
import { domainErrorCode } from '../../domain/errors/DomainError';

const googleClientId = defineString('GOOGLE_CLIENT_ID');
const googleClientSecret = defineString('GOOGLE_CLIENT_SECRET');
const googleRedirectUri = defineString('GOOGLE_REDIRECT_URI', { default: 'postmessage' });
const googleGmailTopic = defineString('GOOGLE_GMAIL_TOPIC');

interface ExchangeGmailCodeRequest {
  code: string;
  tenantId: string;
}

export const exchangeGmailCode = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { code, tenantId } = request.data as ExchangeGmailCodeRequest;

    if (!code || !tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    const clientId = googleClientId.value();
    const clientSecret = googleClientSecret.value();
    const redirectUri = googleRedirectUri.value();
    const topicName = googleGmailTopic.value();

    if (!clientId || !clientSecret) {
      throw new HttpsError('failed-precondition', '@core.workspace/gmail.oauth-missing');
    }

    if (!topicName) {
      throw new HttpsError('failed-precondition', '@core.workspace/gmail.topic-missing');
    }

    try {
      const di = getDI();
      const useCase = di.getExchangeGmailCodeUseCase();

      const connection = await useCase.execute(code, tenantId, request.auth.uid, {
        clientId,
        clientSecret,
        redirectUri,
      }, topicName);

      // Os tokens NÃO voltam: quem os grava é o próprio caso de uso, e o `refresh_token` é a
      // credencial de longo prazo da caixa de e-mail — ela não tem o que fazer no navegador.
      return {
        id: connection.id,
        email: connection.email,
        authorizedByName: connection.authorizedByName,
        authorizedAt: connection.authorizedAt.toISOString(),
        expiration: connection.expiration ?? null,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error
        ? err.message
        : '@core.workspace/gmail.exchange-error';
      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
