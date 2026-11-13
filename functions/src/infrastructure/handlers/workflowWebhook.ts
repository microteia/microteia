import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb as getDB } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import {
  WEBHOOK_DEFAULT_SIGNATURE_HEADER,
  WEBHOOK_MAX_BODY_BYTES,
  WORKFLOW_WEBHOOK_EVENT,
  WORKFLOW_WEBHOOKS_COLLECTION,
  isWebhookHeaderName,
} from '../../domain/schema/workflowWebhook';
import type { WebhookScheme } from '../../domain/schema/workflowWebhook';
import { hashWebhookToken, receiveWebhook } from '../../domain/services/workflowWebhooks';
import type { WebhookCredential } from '../../domain/services/workflowWebhooks';
import { workflowEventDocument, workflowEventsRef } from '../../data/services/workflowEventDocument';

const REGION = 'southamerica-east1';

const webhookRef = (tenantId: string, workflowId: string) =>
  getDB().collection('tenants').doc(tenantId).collection(WORKFLOW_WEBHOOKS_COLLECTION).doc(workflowId);

/** A credencial gravada, no formato que o domínio confere. Documento sem esquema é o token de antes. */
const credentialOf = async (tenantId: string, workflowId: string): Promise<WebhookCredential | null> => {
  const data = (await webhookRef(tenantId, workflowId).get()).data();
  if (!data) return null;
  if (data.scheme === 'hmac') {
    return typeof data.secret === 'string' && typeof data.header === 'string'
      ? { scheme: 'hmac', secret: data.secret, header: data.header }
      : null;
  }
  return typeof data.tokenHash === 'string' ? { scheme: 'token', tokenHash: data.tokenHash } : null;
};

const headersOf = (raw: Record<string, string | string[] | undefined>): Record<string, string | undefined> =>
  Object.fromEntries(Object.entries(raw).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value[0] : value]));

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
    // O `Content-Length` pode não vir (corpo em blocos), então o teto vale também sobre o que chegou.
    const length = Number(request.headers['content-length'] ?? '0');
    const received = request.rawBody?.length ?? 0;
    if ((Number.isFinite(length) && length > WEBHOOK_MAX_BODY_BYTES) || received > WEBHOOK_MAX_BODY_BYTES) {
      response.status(413).json({ error: 'Body too large.', limit: WEBHOOK_MAX_BODY_BYTES });
      return;
    }

    const [tenantId = '', workflowId = ''] = request.path.split('/').filter((part) => part !== '');
    const outcome = await receiveWebhook(
      {
        tenantId,
        workflowId,
        headers: headersOf(request.headers),
        rawBody: request.rawBody?.toString('utf8') ?? '',
        body: request.body,
      },
      {
        credentialOf,
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
  /** Ausente: token. */
  scheme?: WebhookScheme;
  /** Só na assinatura: o cabeçalho em que ela chega. Ausente: `WEBHOOK_DEFAULT_SIGNATURE_HEADER`. */
  header?: string;
}

/**
 * Emite (ou revoga) o token do webhook de uma automação. O token aparece UMA vez, na resposta; o que
 * fica gravado é o hash dele, numa coleção que o cliente não lê. Emitir de novo invalida o anterior —
 * é como se troca uma credencial vazada.
 */
export const manageWorkflowWebhook = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ token: string | null; url: string | null; hint: string | null; scheme?: WebhookScheme; header?: string }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, workflowId, action, scheme = 'token', header } = (request.data ?? {}) as ManageWorkflowWebhookRequest;
    const signatureHeader = (header ?? WEBHOOK_DEFAULT_SIGNATURE_HEADER).trim();
    if ((scheme !== 'token' && scheme !== 'hmac') || (scheme === 'hmac' && !isWebhookHeaderName(signatureHeader))) {
      throw new HttpsError('invalid-argument', '@core.automation/webhook.header-invalid');
    }
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

    // O segredo da assinatura é hex: é o formato que todo sistema aceita colar no campo "secret".
    const token = scheme === 'hmac' ? randomBytes(32).toString('hex') : randomBytes(32).toString('base64url');
    const hint = token.slice(-4);
    await webhookRef(tenantId, workflowId).set({
      ...(scheme === 'hmac'
        ? { scheme: 'hmac', secret: token, header: signatureHeader.toLowerCase() }
        : { scheme: 'token', tokenHash: hashWebhookToken(token).toString('hex') }),
      hint,
      createdAt: Timestamp.now(),
      createdBy: request.auth.uid,
    });
    const project = process.env.GCLOUD_PROJECT ?? '';
    return {
      token,
      hint,
      scheme,
      ...(scheme === 'hmac' ? { header: signatureHeader.toLowerCase() } : {}),
      url: project ? `https://${REGION}-${project}.cloudfunctions.net/workflowWebhook/${tenantId}/${workflowId}` : null,
    };
  },
);
