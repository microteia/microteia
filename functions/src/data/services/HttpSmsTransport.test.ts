import { describe, expect, it } from 'vitest';
import { HttpSmsTransport } from './HttpSmsTransport';
import type { NotificationSmsCredential } from '../../domain/repositories/INotificationDelivery';

const SID = `AC${'a'.repeat(32)}`;

const credential = (overrides: Partial<NotificationSmsCredential['settings']> = {}, secret = 'token'): NotificationSmsCredential => ({
  settings: {
    provider: 'twilio',
    accountSid: SID,
    fromNumber: '+15550001111',
    webhookUrl: '',
    defaultCountryCode: '55',
    appUrl: 'https://app.test',
    ...overrides,
  },
  secret,
});

const recorder = (status = 201, body: unknown = {}) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, transport: new HttpSmsTransport(fetcher) };
};

describe('HttpSmsTransport', () => {
  it('Twilio: POST de formulário com autenticação básica e o remetente', async () => {
    const { calls, transport } = recorder();
    await transport.open(credential()).send('+5571999998888', 'Olá');
    expect(calls[0].url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
    expect(calls[0].init.method).toBe('POST');
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(Object.fromEntries(form)).toEqual({ To: '+5571999998888', Body: 'Olá', From: '+15550001111' });
    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    expect(Buffer.from(auth.replace('Basic ', ''), 'base64').toString()).toBe(`${SID}:token`);
  });

  it('Twilio: o Messaging Service vai como serviço, e não como número', async () => {
    const { calls, transport } = recorder();
    await transport.open(credential({ fromNumber: `MG${'b'.repeat(32)}` })).send('+5571999998888', 'Olá');
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get('MessagingServiceSid')).toBe(`MG${'b'.repeat(32)}`);
    expect(form.get('From')).toBeNull();
  });

  it('a recusa do provedor vira erro com a frase dele', async () => {
    const { transport } = recorder(400, { message: 'invalid To' });
    await expect(transport.open(credential()).send('+1', 'x')).rejects.toThrow('400: invalid To');
  });

  it('webhook: POST JSON com o token como Bearer, sem seguir redirecionamento', async () => {
    const { calls, transport } = recorder(200);
    await transport.open(credential({ provider: 'webhook', webhookUrl: 'https://sms.example.com/send' }, 'abc'))
      .send('+5571999998888', 'Olá');
    expect(calls[0].url).toBe('https://sms.example.com/send');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ to: '+5571999998888', body: 'Olá' });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
    expect(calls[0].init.redirect).toBe('error');
  });

  it('webhook para a rede de dentro é recusado antes de qualquer chamada', async () => {
    const { calls, transport } = recorder(200);
    for (const url of ['http://sms.example.com', 'https://10.0.0.1/x', 'https://metadata.google.internal/', 'https://host:8443/x']) {
      await expect(transport.open(credential({ provider: 'webhook', webhookUrl: url })).send('+1', 'x')).rejects.toThrow();
    }
    expect(calls).toEqual([]);
  });

  it('o teste confere a credencial sem mandar mensagem a ninguém', async () => {
    const twilio = recorder(200);
    await twilio.transport.verify(credential());
    expect(twilio.calls[0]).toMatchObject({ url: `https://api.twilio.com/2010-04-01/Accounts/${SID}.json`, init: { method: 'GET' } });
    const hook = recorder(200);
    await hook.transport.verify(credential({ provider: 'webhook', webhookUrl: 'https://sms.example.com/send' }));
    expect(JSON.parse(String(hook.calls[0].init.body))).toEqual({ test: true });
  });
});
