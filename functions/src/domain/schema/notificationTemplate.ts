// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/notificationTemplate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A APARÊNCIA dos avisos — o que o escritório escolhe, por cima do texto que quem avisou mandou.
 *
 * Duas camadas, e cada uma cai para a de baixo quando falta:
 *
 * 1. o LAYOUT do e-mail (`notifications.email.layout`): logo, cor, assinatura e rodapé, para todo
 *    e-mail que sai do escritório — inclusive o de teste;
 * 2. o MODELO por tipo e por canal (`notifications.templates`): o assunto e o corpo do e-mail, a
 *    versão curta do navegador, o título e a linha do sino — com variáveis (`{guest}`).
 *
 * Sem nada disso, o aviso é o título e a mensagem de sempre. Os dois valores moram nas configurações
 * do ESCRITÓRIO (`settings/tenant`, gravadas por `settings.manage`): não são segredo, ao contrário da
 * senha do SMTP. O texto é do escritório — não se traduz; as variáveis chegam já no idioma de quem lê.
 *
 * Este módulo é compartilhado: a pré-visualização da tela e o envio do servidor montam o MESMO HTML.
 */

export const NOTIFICATION_EMAIL_LAYOUT_SETTING = 'notifications.email.layout';
export const NOTIFICATION_TEMPLATES_SETTING = 'notifications.templates';

/** O modelo dos avisos SEM tipo — o "Geral" da tela. */
export const GENERAL_NOTIFICATION_TEMPLATE = '';

/** As variáveis que todo aviso tem, além das do tipo. */
export const BUILTIN_NOTIFICATION_VARIABLES = ['title', 'message', 'tenant'] as const;

export interface NotificationEmailLayout {
  showLogo: boolean;
  /** `#rrggbb`. Vazio = a cor padrão. */
  accentColor: string;
  /** Markdown, depois do corpo de todo e-mail. */
  signature: string;
  /** Texto curto no fim. Vazio = a frase padrão do produto. */
  footer: string;
}

export const DEFAULT_NOTIFICATION_EMAIL_LAYOUT: NotificationEmailLayout = {
  showLogo: true,
  accentColor: '',
  signature: '',
  footer: '',
};

export interface NotificationChannelTemplates {
  email?: { subject: string; body: string };
  inApp?: { title: string; message: string };
  push?: { title: string; body: string };
}

export type NotificationTemplates = Record<string, NotificationChannelTemplates>;

export type NotificationTemplateChannel = keyof NotificationChannelTemplates;

/**
 * As cores do e-mail. São do PRODUTO entregue numa caixa de correio, e não do tema da tela: o cliente
 * de e-mail não lê o tema, e o fundo claro é o que todos renderizam igual.
 */
const EMAIL_PALETTE = {
  accent: '#3b5bdb',
  page: '#f4f5f7',
  card: '#ffffff',
  text: '#1f2328',
  muted: '#6b7280',
  rule: '#e6e8eb',
  onAccent: '#ffffff',
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

export const asNotificationEmailLayout = (value: unknown): NotificationEmailLayout => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_NOTIFICATION_EMAIL_LAYOUT;
  const raw = value as Record<string, unknown>;
  const accent = text(raw.accentColor, 7);
  return {
    showLogo: raw.showLogo !== false,
    accentColor: HEX_COLOR.test(accent) ? accent : '',
    signature: text(raw.signature, 2000),
    footer: text(raw.footer, 500),
  };
};

const pair = <A extends string, B extends string>(value: unknown, a: A, b: B, max: [number, number]) => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const first = text(raw[a], max[0]);
  const second = text(raw[b], max[1]);
  return first || second ? ({ [a]: first, [b]: second } as Record<A | B, string>) : undefined;
};

/** Malformado é ausente: um modelo quebrado volta ao texto de sempre, e o aviso sai igual. */
export const asNotificationTemplates = (value: unknown): NotificationTemplates => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const templates: NotificationTemplates = {};
  for (const [category, channels] of Object.entries(value as Record<string, unknown>)) {
    if (!channels || typeof channels !== 'object') continue;
    const raw = channels as Record<string, unknown>;
    const email = pair(raw.email, 'subject', 'body', [200, 4000]);
    const inApp = pair(raw.inApp, 'title', 'message', [200, 1000]);
    const push = pair(raw.push, 'title', 'body', [80, 200]);
    const entry: NotificationChannelTemplates = {
      ...(email ? { email } : {}),
      ...(inApp ? { inApp } : {}),
      ...(push ? { push } : {}),
    };
    if (Object.keys(entry).length > 0) templates[category] = entry;
  }
  return templates;
};

/** O modelo de um tipo — o dele, ou o "Geral" quando o tipo não tem um para aquele canal. */
export const notificationTemplateFor = <C extends NotificationTemplateChannel>(
  templates: NotificationTemplates,
  category: string,
  channel: C,
): NotificationChannelTemplates[C] | undefined =>
  templates[category]?.[channel] ?? templates[GENERAL_NOTIFICATION_TEMPLATE]?.[channel];

/** O que o Markdown trataria como marcação: o valor de um registro entra como TEXTO, nunca como link. */
export const escapeMarkdown = (value: string): string => value.replace(/([\\*_[\]()])/g, '\\$1');

/**
 * `{variável}` vira o valor; o que não é variável conhecida fica como estava — o escritório vê na
 * pré-visualização que digitou errado, em vez de um buraco calado no e-mail.
 */
export const fillNotificationTemplate = (
  template: string,
  variables: Record<string, string>,
  escape: (value: string) => string = (value) => value,
): string =>
  template.replace(/\{([a-zA-Z][a-zA-Z0-9_.-]*)\}/g, (match, key: string) =>
    (Object.prototype.hasOwnProperty.call(variables, key) ? escape(variables[key]) : match));

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ESCAPED = /\\([\\*_[\]()])/g;
const PLACEHOLDER = (index: number) => `\u0000${index}\u0000`;

/** Negrito, itálico e link `http(s)` — e só. O resto é texto, já escapado. */
const inline = (source: string): string => {
  // O que não pode ser lido como marcação sai da frente ANTES: o caractere escapado e o link inteiro
  // (um `_` no endereço não pode virar itálico), e volta no fim, já pronto.
  const held: string[] = [];
  const hold = (html: string) => {
    held.push(html);
    return PLACEHOLDER(held.length - 1);
  };
  const protectedSource = source
    .replace(ESCAPED, (_match, char: string) => hold(escapeHtml(char)))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) =>
      hold(`<a href="${escapeHtml(url)}" style="color:inherit">${escapeHtml(label)}</a>`));
  const html = escapeHtml(protectedSource)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
  // eslint-disable-next-line no-control-regex -- o marcador interno é justamente um caractere de controle
  return html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => held[Number(index)] ?? '');
};

/** Markdown SEGURO para e-mail: parágrafos, quebras, listas com `- `, negrito, itálico e links. */
export const renderNotificationMarkdown = (markdown: string): string =>
  markdown
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul style="margin:0 0 12px;padding-left:20px">${lines
          .map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p style="margin:0 0 12px">${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');

/** O mesmo texto, sem marcação — a parte `text/plain` do e-mail. */
export const notificationMarkdownToText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^\\])[*_]([^*_]+)[*_]/g, '$1$2')
    .replace(ESCAPED, '$1');

export interface NotificationEmailParts {
  title: string;
  /** Markdown. */
  body: string;
  linkUrl: string;
  linkLabel: string;
  footer: string;
  tenantName: string;
  logoURL: string | null;
  layout: NotificationEmailLayout;
  /** O descadastro de quem recebe num ENDEREÇO, sem conta onde recusar o canal. Vai no rodapé. */
  unsubscribe?: { url: string; label: string } | null;
}

/** O HTML do e-mail: cartão branco com a cor do escritório, logo, corpo, botão, assinatura e rodapé. */
export const buildNotificationEmailHtml = (parts: NotificationEmailParts): string => {
  const accent = parts.layout.accentColor || EMAIL_PALETTE.accent;
  const logo = parts.layout.showLogo && parts.logoURL && /^https:\/\//.test(parts.logoURL)
    ? `<img src="${escapeHtml(parts.logoURL)}" alt="" height="32" style="height:32px;vertical-align:middle;margin-right:10px;border-radius:6px">`
    : '';
  const header = logo || parts.tenantName
    ? `<div style="padding:20px 28px 0;font-size:14px;font-weight:600;color:${EMAIL_PALETTE.text}">${logo}${escapeHtml(parts.tenantName)}</div>`
    : '';
  const button = parts.linkUrl
    ? `<p style="margin:20px 0 4px"><a href="${escapeHtml(parts.linkUrl)}" style="display:inline-block;background:${accent};color:${EMAIL_PALETTE.onAccent};padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(parts.linkLabel)}</a></p>`
    : '';
  const signature = parts.layout.signature
    ? `<div style="margin-top:20px;color:${EMAIL_PALETTE.muted}">${renderNotificationMarkdown(parts.layout.signature)}</div>`
    : '';
  const unsubscribe = parts.unsubscribe
    ? `<br><a href="${escapeHtml(parts.unsubscribe.url)}" style="color:${EMAIL_PALETTE.muted}">${escapeHtml(parts.unsubscribe.label)}</a>`
    : '';
  return [
    `<div style="background:${EMAIL_PALETTE.page};padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">`,
    `<div style="max-width:560px;margin:0 auto;background:${EMAIL_PALETTE.card};border-radius:12px;overflow:hidden;border-top:4px solid ${accent}">`,
    header,
    `<div style="padding:16px 28px 24px;color:${EMAIL_PALETTE.text};font-size:15px;line-height:1.55">`,
    `<h1 style="font-size:18px;line-height:1.35;margin:0 0 14px">${escapeHtml(parts.title)}</h1>`,
    renderNotificationMarkdown(parts.body),
    button,
    signature,
    '</div>',
    `<div style="padding:14px 28px;border-top:1px solid ${EMAIL_PALETTE.rule};color:${EMAIL_PALETTE.muted};font-size:12px">${escapeHtml(parts.footer)}${unsubscribe}</div>`,
    '</div></div>',
  ].join('');
};

/** A parte em texto puro: mesmo conteúdo, para o cliente que não mostra HTML. */
export const buildNotificationEmailText = (parts: NotificationEmailParts): string =>
  [
    parts.title,
    notificationMarkdownToText(parts.body),
    parts.linkUrl,
    parts.layout.signature ? notificationMarkdownToText(parts.layout.signature) : '',
    parts.footer,
    parts.unsubscribe ? `${parts.unsubscribe.label}: ${parts.unsubscribe.url}` : '',
  ].filter(Boolean).join('\n\n');
