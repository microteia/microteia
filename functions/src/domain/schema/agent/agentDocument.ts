// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/agent/agentDocument.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import { DEFAULT_FILE_MAX_SIZE_MB } from '../fieldRules';

/**
 * O anexo que um agente envia para a aba Documentos de um registro.
 *
 * Tudo aqui é regra PURA — o que o arquivo precisa ser para entrar —, e por isso mora no schema
 * compartilhado e não junto de quem grava no Storage. O teto, o nome no bucket e o tipo são os mesmos
 * que o upload feito pela tela produz: um documento anexado pelo agente é indistinguível, na aba, de
 * um anexado à mão, exceto pelo `createdVia`.
 */

/** A coleção da lista de tipos que a aba Documentos oferece. */
export const DOCUMENT_TYPES_COLLECTION = 'documentTypes';

/**
 * O teto do arquivo, em bytes — o MESMO que a regra do Storage cobra do navegador
 * (`request.resource.size < 20 * 1024 * 1024`). O Admin SDK não passa pela regra, então o teto é
 * repetido aqui de propósito: um agente não pode guardar o que a tela recusaria.
 */
export const AGENT_DOCUMENT_MAX_BYTES = DEFAULT_FILE_MAX_SIZE_MB * 1024 * 1024;

export const AGENT_DOCUMENT_MAX_MB = DEFAULT_FILE_MAX_SIZE_MB;

const BASE64_BODY = /^[A-Za-z0-9+/]*={0,2}$/;
const DATA_URL_PREFIX = /^data:([^;,]*)(?:;[^;,]+)*;base64,/i;

export type AgentFileContent =
  | { ok: true; base64: string; size: number; contentType?: string }
  | { ok: false; reason: 'not-base64' | 'empty' | 'too-large'; size?: number };

/**
 * O conteúdo em base64, conferido ANTES de ser decodificado.
 *
 * O tamanho sai do comprimento do texto, sem decodificar: recusar um arquivo grande depois de
 * alocá-lo inteiro na memória da function seria pagar o custo que o teto existe para evitar. Aceita
 * também o `data:<tipo>;base64,` que muitos clientes produzem, e o tipo declarado ali vale como
 * `contentType` quando a chamada não traz outro.
 */
export const inspectAgentFileContent = (raw: string): AgentFileContent => {
  const trimmed = raw.trim();
  const prefix = DATA_URL_PREFIX.exec(trimmed);
  const body = (prefix ? trimmed.slice(prefix[0].length) : trimmed).replace(/\s+/g, '');
  const contentType = prefix?.[1]?.trim() || undefined;

  if (body.length === 0) return { ok: false, reason: 'empty' };
  if (body.length % 4 !== 0 || !BASE64_BODY.test(body)) return { ok: false, reason: 'not-base64' };

  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  const size = (body.length / 4) * 3 - padding;
  if (size === 0) return { ok: false, reason: 'empty' };
  if (size >= AGENT_DOCUMENT_MAX_BYTES) return { ok: false, reason: 'too-large', size };

  return { ok: true, base64: body, size, ...(contentType ? { contentType } : {}) };
};

/**
 * O nome que a aba mostra. Só o nome — um caminho (`C:\docs\a.pdf`, `../a.pdf`) perde as pastas, e
 * um caractere de controle sai. `null` quando nada sobra.
 */
export const agentDocumentName = (raw: string): string | null => {
  const base = raw.split(/[/\\]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o propósito
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean === '' || clean === '.' || clean === '..' ? null : clean;
};

/**
 * O caminho no bucket, na MESMA forma do upload da tela (`FirebaseRecordDocumentRepository`):
 * `tenants/{t}/{coleção}/{id}/{ts}_{nome}`, com espaços trocados por `_`. É o que faz a regra do
 * Storage, a cascata de exclusão e a leitura pela tela tratarem o arquivo como qualquer outro.
 */
export const agentDocumentStoragePath = (
  tenantId: string,
  collection: string,
  recordId: string,
  name: string,
  now: number,
): string => `tenants/${tenantId}/${collection}/${recordId}/${now}_${name.replace(/\s+/g, '_')}`;

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  rtf: 'application/rtf',
  eml: 'message/rfc822',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

/**
 * O tipo do conteúdo: o declarado vence; sem ele, o da extensão. O navegador faz o mesmo ao escolher
 * o arquivo, e é esse tipo que decide se o link abre o PDF ou o baixa.
 */
export const agentDocumentContentType = (name: string, declared?: string): string => {
  const explicit = declared?.trim();
  if (explicit) return explicit;
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
};

/**
 * O tipo pedido, resolvido contra a lista que a aba oferece. Casa pela CHAVE, que é o que a tela
 * grava; pelo rótulo, sem diferenciar maiúsculas, porque é o que uma pessoa diz ao agente. `null`
 * quando não casa nenhum — e quem chama recusa, listando os aceitos.
 */
/** Uma opção da lista de tipos, como a aba a oferece. */
export interface DocumentTypeOption {
  key: string;
  label: string;
}

export const resolveAgentDocumentType = (
  options: readonly DocumentTypeOption[],
  requested: string,
): string | null => {
  const wanted = requested.trim();
  const byKey = options.find((option) => option.key === wanted);
  if (byKey) return byKey.key;
  const folded = wanted.toLocaleLowerCase();
  return options.find((option) => option.label.toLocaleLowerCase() === folded)?.key ?? null;
};
