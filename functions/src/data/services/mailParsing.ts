import { convert } from 'html-to-text';
import { simpleParser } from 'mailparser';
import type { AddressObject, EmailAddress } from 'mailparser';
import type { ParsedMail } from '../../domain/repositories/IMailReader';

/** O HTML acima disso não é convertido em texto — a conversão é a parte cara do parse. */
const MAX_HTML_TO_TEXT = 2 * 1024 * 1024;

const addressesOf = (value: AddressObject | AddressObject[] | undefined): EmailAddress[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((header) => header.value)
    .flatMap((address) => (address.group ? address.group : [address]));

const emailsOf = (value: AddressObject | AddressObject[] | undefined): string[] =>
  addressesOf(value).map((address) => address.address ?? '').filter((address) => address !== '');

/**
 * A mensagem crua (RFC 822) na forma que a entrega conhece. Uma função só para as duas fontes — a lida por
 * IMAP e a encaminhada —, para que o mesmo e-mail renda o mesmo payload, venha por onde vier.
 */
export const parseMailSource = async (source: Buffer): Promise<ParsedMail> => {
  const parsed = await simpleParser(source, {
    skipImageLinks: true,
    skipTextToHtml: true,
    maxHtmlLengthToParse: MAX_HTML_TO_TEXT,
  });
  const sender = addressesOf(parsed.from)[0];
  const html = typeof parsed.html === 'string' ? parsed.html : '';
  return {
    messageId: parsed.messageId ?? '',
    from: sender?.address ?? '',
    fromName: sender?.name ?? '',
    to: emailsOf(parsed.to),
    cc: emailsOf(parsed.cc),
    replyTo: emailsOf(parsed.replyTo)[0] ?? '',
    subject: parsed.subject ?? '',
    date: parsed.date ?? null,
    // O `mailparser` só converte o HTML em texto quando ele está no topo da mensagem; dentro de
    // `multipart/related` — o e-mail com logotipo, que é quase todo e-mail institucional — o texto vinha
    // vazio, e a automação que lê `event.text` não via nada.
    text: parsed.text || (html && html.length <= MAX_HTML_TO_TEXT ? convert(html, { wordwrap: false }) : ''),
    html,
    // A imagem embutida no corpo (a da assinatura) não é anexo para quem lê o e-mail, e não pode
    // satisfazer um filtro "com anexo".
    attachments: parsed.attachments
      .filter((attachment) => !attachment.related)
      .map((attachment) => ({
        name: attachment.filename ?? '',
        contentType: attachment.contentType,
        size: attachment.size,
      })),
  };
};

/**
 * Os ANEXOS da mensagem crua, com o conteúdo — o que o passo "Salvar anexo do e-mail" grava no registro. A
 * imagem embutida no corpo fica de fora pela mesma razão de `parseMailSource`.
 */
export const parseMailAttachments = async (
  source: Buffer,
): Promise<Array<{ name: string; contentType: string; size: number; content: Buffer }>> => {
  const parsed = await simpleParser(source, { skipImageLinks: true, skipTextToHtml: true, skipHtmlToText: true });
  return parsed.attachments
    .filter((attachment) => !attachment.related)
    .map((attachment) => ({
      name: attachment.filename ?? '',
      contentType: attachment.contentType,
      size: attachment.size,
      content: attachment.content,
    }));
};
