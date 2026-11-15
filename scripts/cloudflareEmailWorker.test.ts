import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../integrations/cloudflare-email-worker/worker.js';
import { inboundSignatureIssue } from '../functions/src/domain/services/mailInbound';
import { MAIL_INBOUND_HEADERS, MAIL_INBOUND_TOKEN_LENGTH, mailInboundTokenOf } from '../src/domain/schema/mailbox';

/**
 * O Worker de referência é JavaScript para colar no painel do Cloudflare, e por isso não importa nada do
 * kernel: cabeçalhos, assinatura e formato do endereço estão escritos nele de novo. Este teste é o que impede
 * as duas cópias de divergirem — o Worker assina, e quem confere é a MESMA função da `mailInbound`.
 */

const CODE = 'a'.repeat(MAIL_INBOUND_TOKEN_LENGTH - 2) + '42';
const RAW = 'From: alguem@example.com\r\nTo: pessoa@example.org\r\nSubject: Teste\r\nMessage-ID: <m1@example.com>\r\n\r\nCorpo';

interface Sent { url: string; headers: Record<string, string>; body: Buffer }

const fakeMessage = (to: string) => {
  const calls = { rejected: null as string | null, forwarded: null as string | null };
  return {
    calls,
    message: {
      to,
      raw: new Response(RAW).body,
      setReject: (reason: string) => { calls.rejected = reason; },
      forward: async (address: string) => { calls.forwarded = address; },
    },
  };
};

/** Cada instalação responde pela ordem da lista; o corpo é o `outcome` do 202 ou o texto do erro. */
const stubFetch = (answers: Array<{ status: number; outcome?: string; text?: string }>): Sent[] => {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', async (url: string, init: { headers: Record<string, string>; body: Uint8Array }) => {
    sent.push({ url, headers: init.headers, body: Buffer.from(init.body) });
    const answer = answers[sent.length - 1] ?? { status: 202, outcome: 'delivered' };
    return answer.status === 202
      ? new Response(JSON.stringify({ outcome: answer.outcome }), { status: 202 })
      : new Response(answer.text ?? '', { status: answer.status });
  });
  return sent;
};

const env = { PROD_URL: 'https://prod.example.com/mailInbound', PROD_SECRET: 's-prod', DEV_URL: 'https://dev.example.com/mailInbound', DEV_SECRET: 's-dev' };

afterEach(() => vi.unstubAllGlobals());

describe('Worker de referência do Cloudflare', () => {
  it('assina do jeito que a mailInbound confere, com os cabeçalhos dela', async () => {
    const sent = stubFetch([{ status: 202, outcome: 'delivered' }]);
    const { message } = fakeMessage(`${CODE}@example.com`);
    await worker.email(message, { ONLY_URL: 'https://one.example.com/mailInbound', ONLY_SECRET: 'segredo' });

    expect(sent).toHaveLength(1);
    const { headers, body } = sent[0];
    expect(Object.keys(headers)).toEqual(expect.arrayContaining(Object.values(MAIL_INBOUND_HEADERS)));
    expect(body.toString()).toBe(RAW);
    const issue = inboundSignatureIssue(
      'segredo',
      {
        timestamp: headers[MAIL_INBOUND_HEADERS.timestamp],
        recipient: headers[MAIL_INBOUND_HEADERS.recipient],
        signature: headers[MAIL_INBOUND_HEADERS.signature],
      },
      body,
      Math.floor(Date.now() / 1000),
    );
    expect(issue).toBeNull();
    expect(mailInboundTokenOf(headers[MAIL_INBOUND_HEADERS.recipient], 'example.com')).toBe(CODE);
  });

  it('o endereço que não é de caixa não sai do Cloudflare: vai para FALLBACK_TO ou é recusado', async () => {
    const sent = stubFetch([]);
    const comFallback = fakeMessage('contato@example.com');
    await worker.email(comFallback.message, { ...env, FALLBACK_TO: 'eu@example.org' });
    const semFallback = fakeMessage(`${CODE}x@example.com`);
    await worker.email(semFallback.message, env);

    expect(sent).toHaveLength(0);
    expect(comFallback.calls.forwarded).toBe('eu@example.org');
    expect(semFallback.calls.rejected).toBe('Unknown address');
  });

  it('com várias instalações, passa à seguinte quando uma não conhece o endereço ou não tem a function', async () => {
    const sent = stubFetch([{ status: 404, text: 'Not found' }, { status: 202, outcome: 'unknown-recipient' }]);
    const { message, calls } = fakeMessage(`${CODE}+etiqueta@example.com`);
    await worker.email(message, { ...env, QA_URL: 'https://qa.example.com/mailInbound', QA_SECRET: 's-qa' });

    expect(sent.map((one) => one.url)).toEqual([env.DEV_URL, env.PROD_URL, 'https://qa.example.com/mailInbound']);
    expect(calls.rejected).toBeNull();
  });

  it('ninguém conhece: recusa; erro de servidor: lança, para o remetente tentar de novo; 413: recusa na hora', async () => {
    stubFetch([{ status: 202, outcome: 'unknown-recipient' }, { status: 202, outcome: 'unknown-recipient' }]);
    const ninguem = fakeMessage(`${CODE}@example.com`);
    await worker.email(ninguem.message, env);
    expect(ninguem.calls.rejected).toBe('Unknown address');

    stubFetch([{ status: 500 }, { status: 202, outcome: 'unknown-recipient' }]);
    await expect(worker.email(fakeMessage(`${CODE}@example.com`).message, env)).rejects.toThrow('mailInbound failed');

    const sent = stubFetch([{ status: 413 }]);
    const grande = fakeMessage(`${CODE}@example.com`);
    await worker.email(grande.message, env);
    expect(grande.calls.rejected).toBe('Message too large');
    expect(sent).toHaveLength(1);
  });

  it('o formato do endereço escrito no Worker é o do kernel', () => {
    const source = readFileSync('integrations/cloudflare-email-worker/worker.js', 'utf8');
    expect(source).toContain(`/^[a-z0-9]{${MAIL_INBOUND_TOKEN_LENGTH}}$/`);
  });
});
