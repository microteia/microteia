const CONTROL_CHAR_CODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127];
const CONTROL_CHARS_REGEX = new RegExp(`[${CONTROL_CHAR_CODES.map((code) => String.fromCharCode(code)).join('')}]`, 'g');

/**
 * Neutraliza `<`, `>` e crase antes de qualquer conteúdo externo (e-mail, erro de parser/IA)
 * entrar em um campo Markdown. `AuditLog.text` é renderizado com `rehype-raw` e sem sanitizador
 * (ver MarkdownContent.view.tsx) — sem isso, HTML/script embutido no e-mail seria renderizado cru.
 */
export const sanitizeForMarkdown = (value: unknown, maxLength = 4000): string => {
  if (value === null || value === undefined || value === '') return '';
  const text = typeof value === 'string' ? value : String(value);

  let sanitized = text
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/`/g, '´');

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.slice(0, maxLength)}\n\n_(conteúdo truncado)_`;
  }

  return sanitized;
};

export interface GmailPushEmailFailureInput {
  reason: 'parser' | 'ia';
  tenantName: string;
  emailId: string;
  from: string;
  to: string;
  subject: string;
  errorMessage: string;
  bodyText?: string;
  bodyHtml?: string;
}

const FAILURE_LABEL: Record<GmailPushEmailFailureInput['reason'], string> = {
  parser: 'Parser',
  ia: 'Inteligência Artificial',
};

export const buildEmailFailureAuditTitle = (reason: GmailPushEmailFailureInput['reason']): string =>
  `Falha crítica ao processar e-mail (${FAILURE_LABEL[reason]})`;

export const buildEmailFailureAuditText = (input: GmailPushEmailFailureInput): string => {
  const label = FAILURE_LABEL[input.reason];

  const lines = [
    `## Falha crítica no processamento de e-mail — ${label}`,
    '',
    `**Escritório:** ${sanitizeForMarkdown(input.tenantName, 200)}`,
    `**E-mail ID:** \`${sanitizeForMarkdown(input.emailId, 200)}\``,
    `**De:** \`${sanitizeForMarkdown(input.from, 300)}\``,
    `**Para:** \`${sanitizeForMarkdown(input.to, 300)}\``,
    `**Assunto:** \`${sanitizeForMarkdown(input.subject, 300)}\``,
    '',
    `**Erro (${label}):**`,
    '```',
    sanitizeForMarkdown(input.errorMessage, 2000) || '_(sem mensagem de erro)_',
    '```',
    '',
    '**Conteúdo do e-mail (texto):**',
    '```',
    sanitizeForMarkdown(input.bodyText, 3000) || '_(vazio)_',
    '```',
  ];

  if (input.bodyHtml) {
    lines.push(
      '',
      '**Conteúdo do e-mail (HTML, amostra):**',
      '```',
      sanitizeForMarkdown(input.bodyHtml, 3000),
      '```',
    );
  }

  return lines.join('\n');
};

export interface GmailPushTokenRefreshFailureInput {
  tenantName: string;
  connectionId: string;
  emailAddress: string;
  errorMessage: string;
}

export const buildTokenRefreshFailureAuditTitle = (): string =>
  'Falha crítica ao renovar token de acesso do Gmail';

export const buildTokenRefreshFailureAuditText = (input: GmailPushTokenRefreshFailureInput): string => {
  const lines = [
    '## Falha crítica na renovação do token de acesso do Gmail',
    '',
    `**Escritório:** ${sanitizeForMarkdown(input.tenantName, 200)}`,
    `**Conexão Gmail ID:** \`${sanitizeForMarkdown(input.connectionId, 200)}\``,
    `**E-mail conectado:** \`${sanitizeForMarkdown(input.emailAddress, 300)}\``,
    '',
    '**Erro:**',
    '```',
    sanitizeForMarkdown(input.errorMessage, 2000) || '_(sem mensagem de erro)_',
    '```',
    '',
    '**Ação necessária:**',
    '',
    'O token de acesso do Gmail expirou e não foi possível renová-lo automaticamente. ',
    'Isso impedirá o recebimento de novas intimações por e-mail até que a conexão seja reautorizada.',
    '',
    '**Como resolver:**',
    '',
    '1. Acesse as configurações do escritório',
    '2. Vá para a seção de Integrações → Gmail',
    '3. Remova a conexão atual',
    '4. Conecte novamente com a conta do Gmail',
  ];

  return lines.join('\n');
};
