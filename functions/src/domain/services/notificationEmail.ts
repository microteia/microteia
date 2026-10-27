import type { EmailMessage } from '../repositories/INotificationDelivery';
import {
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  DEFAULT_NOTIFICATION_EMAIL_LAYOUT,
  type NotificationEmailLayout,
} from '../schema/notificationTemplate';

export interface NotificationEmailContent {
  to: string;
  title: string;
  /** Markdown seguro: o que veio de registro já chega escapado (`escapeMarkdown`). */
  message: string;
  linkUrl: string;
  linkLabel: string;
  footer: string;
  tenantName?: string;
  logoURL?: string | null;
  layout?: NotificationEmailLayout;
  /** O descadastro de quem recebe num endereço: vai no rodapé e no cabeçalho `List-Unsubscribe`. */
  unsubscribe?: { url: string; label: string } | null;
}

/** Uma linha de cabeçalho não pode carregar quebra: seria a porta de injeção de cabeçalho no SMTP. */
const singleLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * O e-mail de uma notificação, em texto e em HTML, com o LAYOUT do escritório (logo, cor, assinatura,
 * rodapé). O HTML sai de `buildNotificationEmailHtml` — o mesmo que a pré-visualização da tela monta.
 * O cabeçalho não carrega quebra de linha: seria a porta de injeção de cabeçalho no SMTP.
 */
export const renderNotificationEmail = (content: NotificationEmailContent): EmailMessage => {
  const parts = {
    title: singleLine(content.title),
    body: content.message,
    linkUrl: content.linkUrl,
    linkLabel: content.linkLabel,
    footer: content.footer,
    tenantName: content.tenantName ?? '',
    logoURL: content.logoURL ?? null,
    layout: content.layout ?? DEFAULT_NOTIFICATION_EMAIL_LAYOUT,
    unsubscribe: content.unsubscribe ?? null,
  };
  return {
    to: singleLine(content.to),
    subject: parts.title,
    text: buildNotificationEmailText(parts),
    html: buildNotificationEmailHtml(parts),
    ...(content.unsubscribe ? { unsubscribeUrl: singleLine(content.unsubscribe.url) } : {}),
  };
};

/** O endereço que o link do e-mail abre: a aplicação do escritório mais a chave da aba. */
export const notificationLinkUrl = (appUrl: string, link: string): string => {
  if (!appUrl || !link) return '';
  // `link` já é o caminho pronto (`appDeepLinkPath`), com a aba codificada: codificar de novo
  // transformaria o `%3A` da aba em `%253A`, e o link abriria nada.
  return `${appUrl.replace(/\/+$/, '')}/${link.replace(/^\/+/, '')}`;
};
