import type { ISmsTransport, NotificationSmsCredential, SmsSession } from '../../domain/repositories/INotificationDelivery';
import { isPublicHttpsEndpoint } from '../../domain/schema/notifications';

const SMS_TIMEOUT_MS = 15_000;
const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const basicAuth = (user: string, password: string): string =>
  `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;

const detailOf = async (response: Response): Promise<string> => {
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    return typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
};

/** A frase que o provedor devolveu, quando há uma — é ela que o log da execução e a tela mostram. */
const failureOf = async (response: Response): Promise<Error> => {
  const detail = await detailOf(response);
  return new Error(detail ? `${response.status}: ${detail}` : `HTTP ${response.status}`);
};

/**
 * SMS por HTTP, sem SDK de provedor: a Twilio pela API REST dela, e qualquer outro por um `webhook` do
 * escritório que recebe `{ to, body }`. O kernel não conhece o nome de nenhum outro provedor — quem
 * quer um diferente põe a ponte no webhook.
 *
 * O webhook é um POST que a FUNCTION faz para um endereço que o escritório digitou: passa pela mesma
 * guarda do push (`https`, sem IP cru, sem host interno) a cada envio, e não segue redirecionamento —
 * um 302 para dentro da rede contornaria a guarda.
 */
export class HttpSmsTransport implements ISmsTransport {
  constructor(private readonly fetcher: Fetcher = (input, init) => fetch(input, init)) {}

  open(credential: NotificationSmsCredential): SmsSession {
    return { send: (to, body) => this.send(credential, to, body) };
  }

  async verify(credential: NotificationSmsCredential): Promise<void> {
    const { settings, secret } = credential;
    if (settings.provider === 'twilio') {
      const response = await this.fetcher(`${TWILIO_API}/${encodeURIComponent(settings.accountSid)}.json`, {
        method: 'GET',
        headers: { Authorization: basicAuth(settings.accountSid, secret) },
        signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
      });
      if (!response.ok) throw await failureOf(response);
      return;
    }
    await this.webhook(settings.webhookUrl, secret, { test: true });
  }

  private async send(credential: NotificationSmsCredential, to: string, body: string): Promise<void> {
    const { settings, secret } = credential;
    if (settings.provider === 'webhook') {
      await this.webhook(settings.webhookUrl, secret, { to, body });
      return;
    }
    const from = settings.fromNumber.trim();
    const form = new URLSearchParams({ To: to, Body: body });
    if (from.startsWith('MG')) form.set('MessagingServiceSid', from);
    else form.set('From', from);
    const response = await this.fetcher(`${TWILIO_API}/${encodeURIComponent(settings.accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(settings.accountSid, secret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
    });
    if (!response.ok) throw await failureOf(response);
  }

  private async webhook(url: string, secret: string, payload: Record<string, unknown>): Promise<void> {
    if (!isPublicHttpsEndpoint(url)) throw new Error('@core.automation/notifications.sms.issue.webhook');
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
    });
    if (!response.ok) throw await failureOf(response);
  }
}
