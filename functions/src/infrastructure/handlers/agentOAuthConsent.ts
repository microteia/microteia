import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  OAUTH_CODE_TTL_MS,
  buildAuthCode,
} from '../../domain/schema/agent/agentOAuth';
import { generateAgentSecret, hashAgentSecret } from '../../domain/schema/agent/agentGrant';
import { getDI } from '../di/container';
import { issueAgentGrant } from '../agent/issueAgentGrant';
import { AGENT_REGION } from '../agent/agentOrigin';

interface AgentAuthRequestView {
  /** Quem diz ser — conferido contra o documento de identidade, nunca o que veio na consulta. */
  clientName: string;
  clientId: string;
  /** O host para onde a autorização volta. A spec manda MOSTRÁ-LO; é a única pista de destino. */
  redirectHost: string;
  /**
   * O destino é só a máquina de quem está autorizando.
   *
   * A spec pede um aviso extra nesse caso, e a razão é concreta: qualquer processo local pode abrir
   * uma porta e dizer que é o cliente. Quem autoriza precisa saber que a garantia ali é menor.
   */
  loopbackOnly: boolean;
}

const pendingOrFail = async (requestId: string) => {
  const request = await getDI().getAgentAuthRequestRepository().getById(requestId);
  if (request === null) throw new HttpsError('not-found', '@core.access/agent.oauth.request.unknown');
  if (request.expiresAt.getTime() <= Date.now()) {
    throw new HttpsError('deadline-exceeded', '@core.access/agent.oauth.request.expired');
  }
  // Já consentido não é "consinta de novo": duas abas na mesma tela emitiriam dois acessos, e a
  // pessoa só se lembraria de ter autorizado um.
  if (request.codeHash !== null) {
    throw new HttpsError('failed-precondition', '@core.access/agent.oauth.request.used');
  }
  return request;
};

/**
 * O que a tela de consentimento mostra sobre quem está pedindo.
 *
 * Tudo aqui é DERIVADO do que o `/authorize` já conferiu: o nome vem do documento de identidade do
 * cliente, não de um parâmetro, e o host vem do redirecionamento que já foi casado contra aquele
 * documento. Nada que o navegador mande chega à tela sem ter passado por lá.
 */
export const getAgentAuthRequest = onCall(
  { region: AGENT_REGION, cors: true },
  async (request): Promise<AgentAuthRequestView> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const requestId = typeof request.data?.requestId === 'string' ? request.data.requestId : '';
    const pending = await pendingOrFail(requestId);
    const redirect = new URL(pending.redirectUri);

    return {
      clientName: pending.clientName,
      clientId: pending.clientId,
      redirectHost: redirect.host,
      loopbackOnly: redirect.protocol === 'http:',
    };
  },
);

interface ConsentRequest {
  requestId: string;
  tenantId: string;
  permissions: string[];
  expiresInDays?: number | null;
}

interface ConsentResponse {
  /** Para onde o navegador volta. O código viaja aqui, e só aqui. */
  redirectTo: string;
}

/**
 * O consentimento — e ele é uma EMISSÃO DE ACESSO, pela mesma porta da tela de Agentes de IA.
 *
 * `issueAgentGrant` é o que garante isso: o portão da extensão, o teto nunca acima de quem consente,
 * a recusa do curinga, o catálogo de permissões e a configuração de auto-serviço do escritório valem
 * aqui exatamente como valem lá. Consentir num fluxo de OAuth não é um segundo caminho de
 * autorização — é a mesma emissão, com outra tela na frente.
 *
 * O acesso nasce com o segredo JÁ VENCIDO e sem refresh: o que ele tem é um código, e é a troca no
 * `/token` que estreia o par. Um acesso que nunca for trocado fica na lista como vencido, que é
 * exatamente o que ele é — nada foi entregue a ninguém.
 */
export const consentAgentAuthRequest = onCall(
  { region: AGENT_REGION, cors: true },
  async (request): Promise<ConsentResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { requestId, tenantId, permissions, expiresInDays } = request.data as ConsentRequest;
    const pending = await pendingOrFail(requestId);

    const { grantId } = await issueAgentGrant({
      tenantId,
      userId: request.auth.uid,
      session: request.auth.token,
      name: pending.clientName,
      permissions,
      expiresInDays,
      origin: 'oauth',
      // Vencido de propósito. O token devolvido por `issueAgentGrant` é descartado aqui — quem o
      // emite de verdade é a troca do código —, e um segredo gravado vivo sem ninguém tê-lo recebido
      // é uma credencial que existe sem dono.
      accessExpiresAt: new Date(0),
      refreshHash: null,
      clientId: pending.clientId,
    });

    const secret = generateAgentSecret();
    const code = buildAuthCode({ scope: tenantId, id: pending.id, secret });
    if (code === null) {
      await getDI().getAgentGrantRepository().revoke(tenantId, grantId, request.auth.uid);
      throw new HttpsError('internal', '@core.access/agent.token.failed');
    }

    const consented = await getDI().getAgentAuthRequestRepository().consent(pending.id, {
      tenantId,
      userId: request.auth.uid,
      grantId,
      codeHash: await hashAgentSecret(secret),
      expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_MS),
    });
    if (!consented) {
      // Perdeu a corrida para outra aba. O acesso recém-criado não serve a ninguém: ninguém recebeu
      // segredo dele, e deixá-lo na lista seria um acesso que a pessoa não reconhece.
      await getDI().getAgentGrantRepository().revoke(tenantId, grantId, request.auth.uid);
      throw new HttpsError('failed-precondition', '@core.access/agent.oauth.request.used');
    }

    const target = new URL(pending.redirectUri);
    target.searchParams.set('code', code);
    if (pending.state !== null) target.searchParams.set('state', pending.state);
    return { redirectTo: target.toString() };
  },
);
