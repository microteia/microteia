import type { EmailMessage } from '../repositories/INotificationDelivery';

export interface NotificationEmailContent {
  to: string;
  title: string;
  message: string;
  linkUrl: string;
  linkLabel: string;
  footer: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const paragraphs = (value: string): string =>
  value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Uma linha de cabeçalho não pode carregar quebra: seria a porta de injeção de cabeçalho no SMTP. */
const singleLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * O e-mail de uma notificação, em texto e em HTML. Tudo o que vem do fluxo é ESCAPADO: o título e a
 * mensagem podem carregar valor de registro, e um registro é escrito por qualquer membro.
 */
export const renderNotificationEmail = (content: NotificationEmailContent): EmailMessage => {
  const link = content.linkUrl
    ? `<p><a href="${escapeHtml(content.linkUrl)}">${escapeHtml(content.linkLabel)}</a></p>`
    : '';
  return {
    to: singleLine(content.to),
    subject: singleLine(content.title),
    text: [content.message, content.linkUrl, content.footer].filter(Boolean).join('\n\n'),
    html: `<div>${paragraphs(content.message)}${link}<hr><p><small>${escapeHtml(content.footer)}</small></p></div>`,
  };
};

/** O endereço que o link do e-mail abre: a aplicação do escritório mais a chave da aba. */
export const notificationLinkUrl = (appUrl: string, link: string): string => {
  if (!appUrl || !link) return '';
  // `link` já é o caminho pronto (`appDeepLinkPath`), com a aba codificada: codificar de novo
  // transformaria o `%3A` da aba em `%253A`, e o link abriria nada.
  return `${appUrl.replace(/\/+$/, '')}/${link.replace(/^\/+/, '')}`;
};
