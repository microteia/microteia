import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getDI } from '../di/container';

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
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { code, tenantId } = request.data as ExchangeGmailCodeRequest;

    if (!code || !tenantId) {
      throw new HttpsError('invalid-argument', 'code e tenantId são obrigatórios.');
    }

    const clientId = googleClientId.value();
    const clientSecret = googleClientSecret.value();
    const redirectUri = googleRedirectUri.value();
    const topicName = googleGmailTopic.value();

    if (!clientId || !clientSecret) {
      throw new HttpsError('failed-precondition', 'Credenciais OAuth não configuradas no backend.');
    }

    if (!topicName) {
      throw new HttpsError('failed-precondition', 'Tópico Gmail não configurado no backend.');
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
      const message = err instanceof Error ? err.message : 'Erro ao trocar código OAuth.';
      
      if (message.includes('não é membro')) {
        throw new HttpsError('permission-denied', message);
      }
      if (message.includes('Apenas administradores')) {
        throw new HttpsError('permission-denied', message);
      }
      
      throw new HttpsError('internal', message);
    }
  },
);
