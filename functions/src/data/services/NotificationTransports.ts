import { createTransport } from 'nodemailer';
import * as webpush from 'web-push';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  EmailSession,
  IEmailTransport,
  IWebPushSender,
  NotificationEmailCredential,
} from '../../domain/repositories/INotificationDelivery';
import type { WebPushPayload } from '../../domain/schema/notifications';
import { PUSH_SUBSCRIPTIONS_COLLECTION, isPushEndpointAllowed } from '../../domain/schema/notifications';

const SMTP_TIMEOUT_MS = 15_000;

export class SmtpEmailTransport implements IEmailTransport {
  open(credential: NotificationEmailCredential): EmailSession {
    const { settings, password } = credential;
    const transporter = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      pool: true,
      maxConnections: 3,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      ...(settings.username ? { auth: { user: settings.username, pass: password } } : {}),
    });
    const from = settings.fromName
      ? { name: settings.fromName.replace(/[\r\n"]+/g, ' ').trim(), address: settings.fromAddress }
      : settings.fromAddress;
    return {
      send: async ({ unsubscribeUrl, ...message }) => {
        await transporter.sendMail({ from, ...message, ...(unsubscribeUrl ? { list: { unsubscribe: unsubscribeUrl } } : {}) });
      },
      close: () => transporter.close(),
    };
  }
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * As chaves VAPID da instalação, sorteadas pelo próprio servidor na primeira vez que alguém pede.
 *
 * Elas não são configuração de ninguém: o escritório não tem o que escolher, e uma chave que precisasse
 * ser cadastrada no deploy seria mais um passo manual numa instalação que não deve ter nenhum. Vivem
 * numa coleção de RAIZ que nenhuma regra libera — o navegador só recebe a pública, pela callable.
 */
export class VapidKeyStore {
  private cached: Promise<VapidKeys> | null = null;

  constructor(private readonly db: Firestore) {}

  keys(): Promise<VapidKeys> {
    if (!this.cached) {
      this.cached = this.loadOrCreate().catch((error) => {
        this.cached = null;
        throw error;
      });
    }
    return this.cached;
  }

  private async loadOrCreate(): Promise<VapidKeys> {
    const ref = this.db.collection('kernel_secrets').doc('web-push');
    return this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const data = snap.data();
      if (typeof data?.publicKey === 'string' && typeof data?.privateKey === 'string') {
        return { publicKey: data.publicKey, privateKey: data.privateKey };
      }
      const generated = webpush.generateVAPIDKeys();
      transaction.set(ref, { ...generated, createdAt: new Date() });
      return generated;
    });
  }
}

const GONE_STATUS = new Set([404, 410]);
const PUSH_TTL_SECONDS = 24 * 60 * 60;

/**
 * Entrega por Web Push padrão (RFC 8030 + VAPID), sem Firebase Cloud Messaging: não exige chave do
 * projeto no bundle nem configuração no Console, e funciona em qualquer navegador que implementa o
 * padrão. A inscrição que o serviço de push diz não existir mais (404/410) é apagada no caminho.
 */
export class StandardWebPushSender implements IWebPushSender {
  constructor(
    private readonly db: Firestore,
    private readonly vapid: VapidKeyStore,
    private readonly subject: () => string,
  ) {}

  async send(payloads: ReadonlyMap<string, WebPushPayload>): Promise<{ delivered: Set<string>; failed: Set<string> }> {
    const delivered = new Set<string>();
    const failed = new Set<string>();
    if (payloads.size === 0) return { delivered, failed };

    const keys = await this.vapid.keys();
    const vapidDetails = { subject: this.subject(), publicKey: keys.publicKey, privateKey: keys.privateKey };

    await Promise.all([...payloads].map(async ([userId, payload]) => {
      const subscriptions = await this.db
        .collection('users')
        .doc(userId)
        .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
        .limit(10)
        .get();
      if (subscriptions.empty) return;

      const body = JSON.stringify(payload);
      const outcomes = await Promise.all(subscriptions.docs.map(async (doc) => {
        const data = doc.data();
        if (!isPushEndpointAllowed(String(data.endpoint ?? ''))) {
          await doc.ref.delete().catch(() => undefined);
          return false;
        }
        try {
          await webpush.sendNotification(
            { endpoint: String(data.endpoint), keys: { p256dh: String(data.keys?.p256dh), auth: String(data.keys?.auth) } },
            body,
            { vapidDetails, TTL: PUSH_TTL_SECONDS },
          );
          return true;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status !== undefined && GONE_STATUS.has(status)) await doc.ref.delete().catch(() => undefined);
          return false;
        }
      }));

      if (outcomes.some(Boolean)) delivered.add(userId);
      else failed.add(userId);
    }));

    return { delivered, failed };
  }
}
