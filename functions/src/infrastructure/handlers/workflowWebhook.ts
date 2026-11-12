import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb as getDB } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import {
  WEBHOOK_MAX_BODY_BYTES,
  WORKFLOW_WEBHOOK_EVENT,
  WORKFLOW_WEBHOOKS_COLLECTION,
} from '../../domain/schema/workflowWebhook';
import { receiveWebhook } from '../../domain/services/workflowWebhooks';
import { workflowEventDocument, workflowEventsRef } from '../../data/services/workflowEventDocument';

const REGION = 'southamerica-east1';

const hashToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

const webhookRef = (tenantId: string, workflowId: string) =>
  getDB().collection('tenants').doc(tenantId).collection(WORKFLOW_WEBHOOKS_COLLECTION).doc(workflowId);

/** O token vem num CABEÇALHO, nunca na URL: a URL vai para log de proxy, de navegador e do próprio Cloud Run. */
const tokenOf = (authorization: string | undefined, header: string | string[] | undefined): string => {
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  if (bearer) return bearer[1].trim();
  return typeof header === 'string' ? header.trim() : '';
};

/**
 * O webhook de ENTRADA de uma automação: `POST …/workflowWebhook/<tenantId>/<workflowId>`, com o token
 * em `Authorization: Bearer <token>` (ou `X-Microteia-Token`), e o corpo JSON como payload do evento
 * `webhook.received` — dirigido só àquela automação, pela mesma porta de todo evento.
 *
 * Responde 202 assim que o evento é publicado: quem chama não espera a automação rodar, e um retry dele
 * por timeout publicaria o mesmo pedido duas vezes.
 */
export const workflowWebhook = onRequest(
  { region: REGION, cors: false },
  async (request, response): Promise<void> => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Use POST with a JSON body.' });
      return;
    }
    const length = Number(request.headers['content-length'] ?? '0');
    if (Number.isFinite(length) && length > WEBHOOK_MAX_BODY_BYTES) {
      response.status(413).json({ error: 'Body too large.', limit: WEBHOOK_MAX_BODY_BYTES });
      return;
    }

    const [tenantId = '', workflowId = ''] = request.path.split('/').filter((part) => part !== '');
    const outcome = await receiveWebhook(
      {
        tenantId,
        workflowId,
        token: tokenOf(request.headers.authorization, request.headers['x-microteia-token']),
        body: request.body,
      },
      {
        verifyToken: async (tenant, workflow, token) => {
          const stored = (await webhookRef(tenant, workflow).get()).get('tokenHash');
          if (typeof stored !== 'string' || stored.length !== 64) return false;
          return timingSafeEqual(Buffer.from(stored, 'hex'), hashToken(token));
        },
        findDefinition: (tenant, workflow) => getDI().getWorkflowDefinitionRepository().findById(tenant, workflow),
        publish: async (tenant, workflow, payload) => {
          const ref = await workflowEventsRef(getDB(), tenant).add(
            workflowEventDocument(WORKFLOW_WEBHOOK_EVENT, payload, { target: workflow }),
          );
          return ref.id;
        },
      },
    );

    if (outcome.status === 202) {
      response.status(202).json({ eventId: outcome.eventId });
      return;
    }
    response.status(outcome.status).json({ error: outcome.reason, ...(outcome.missing ? { missing: outcome.missing } : {}) });
  },
);

interface ManageWorkflowWebhookRequest {
  tenantId: string;
  workflowId: string;
  action: 'issue' | 'revoke';
}

/**
 * Emite (ou revoga) o token do webhook de uma automação. O token aparece UMA vez, na resposta; o que
 * fica gravado é o hash dele, numa coleção que o cliente não lê. Emitir de novo invalida o anterior —
 * é como se troca uma credencial vazada.
 */
export const manageWorkflowWebhook = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ token: string | null; url: string | null; hint: string | null }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, workflowId, action } = (request.data ?? {}) as ManageWorkflowWebhookRequest;
    if (!tenantId || !workflowId || (action !== 'issue' && action !== 'revoke')) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }
    await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_MANAGE);

    if (action === 'revoke') {
      await webhookRef(tenantId, workflowId).delete();
      return { token: null, url: null, hint: null };
    }

    const definition = await getDI().getWorkflowDefinitionRepository().findById(tenantId, workflowId);
    if (!definition || definition.eventName !== WORKFLOW_WEBHOOK_EVENT) {
      throw new HttpsError('failed-precondition', '@core.automation/webhook.not-webhook');
    }

    const token = randomBytes(32).toString('base64url');
    const hint = token.slice(-4);
    await webhookRef(tenantId, workflowId).set({
      tokenHash: hashToken(token).toString('hex'),
      hint,
      createdAt: Timestamp.now(),
      createdBy: request.auth.uid,
    });
    const project = process.env.GCLOUD_PROJECT ?? '';
    return {
      token,
      hint,
      url: project ? `https://${REGION}-${project}.cloudfunctions.net/workflowWebhook/${tenantId}/${workflowId}` : null,
    };
  },
);
