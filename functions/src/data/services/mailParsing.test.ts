import { describe, expect, it } from 'vitest';
import { parseMailSource } from './mailParsing';

const RAW = [
  'From: "Tribunal de Justiça" <intimacao@tjba.jus.br>',
  'To: Pessoa <pessoa@gmail.com>, grupo: a@x.com, b@x.com;',
  'Cc: c@x.com',
  'Reply-To: resposta@tjba.jus.br',
  'Subject: =?UTF-8?Q?Intima=C3=A7=C3=A3o_eletr=C3=B4nica?=',
  'Message-ID: <abc123@tjba.jus.br>',
  'Date: Fri, 14 Nov 2026 10:00:00 -0300',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="mixed"',
  '',
  '--mixed',
  'Content-Type: multipart/related; boundary="related"',
  '',
  '--related',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Processo 0001234-56.2026.8.05.0001</p><img src="cid:logo">',
  '--related',
  'Content-Type: image/png; name="logo.png"',
  'Content-ID: <logo>',
  'Content-Disposition: inline; filename="logo.png"',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgo=',
  '--related--',
  '--mixed',
  'Content-Type: application/pdf; name="decisao.pdf"',
  'Content-Disposition: attachment; filename="decisao.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--mixed--',
  '',
].join('\r\n');

describe('parseMailSource', () => {
  it('lê endereços, assunto codificado, corpo e anexos — sem contar a imagem da assinatura', async () => {
    const mail = await parseMailSource(Buffer.from(RAW));
    expect(mail.messageId).toBe('<abc123@tjba.jus.br>');
    expect(mail.from).toBe('intimacao@tjba.jus.br');
    expect(mail.fromName).toBe('Tribunal de Justiça');
    expect(mail.to).toEqual(['pessoa@gmail.com', 'a@x.com', 'b@x.com']);
    expect(mail.cc).toEqual(['c@x.com']);
    expect(mail.replyTo).toBe('resposta@tjba.jus.br');
    expect(mail.subject).toBe('Intimação eletrônica');
    expect(mail.date?.toISOString()).toBe('2026-11-14T13:00:00.000Z');
    expect(mail.html).toContain('0001234-56.2026.8.05.0001');
    expect(mail.text).toContain('0001234-56.2026.8.05.0001');
    expect(mail.attachments).toEqual([{ name: 'decisao.pdf', contentType: 'application/pdf', size: 9 }]);
  });
});
