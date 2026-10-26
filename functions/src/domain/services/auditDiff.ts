import type { AuditAction, AuditSeverity } from '../entities/AuditLog';
import { isTimestampLike } from './normalizeFirestoreValue';
import { RECORD_DOCUMENT_SERVER_STAMPS } from './recordDocumentHash';

import type { LocalizedMessage } from '../schema/i18n/localizedMessage';
export type EntityData = Record<string, unknown>;

export interface FieldDiff {
  before: EntityData;
  after: EntityData;
}

const IGNORED_KEYS = new Set([
  'updatedAt', 'updatedBy', 'updatedByName', 'updatedByPhotoURL', 'updatedVia', 'createdVia', 'portalVerified',
  'deletedBy', 'deletedByName', 'deletedByPhotoURL',
  'id', 'tenantId',
  ...RECORD_DOCUMENT_SERVER_STAMPS,
]);

const formatDateBR = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
  if (!hasTime) return datePart;
  return `${datePart} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

const normalizeValue = (v: unknown): unknown => {
  if (v === null || v === undefined) return v;
  if (isTimestampLike(v)) return formatDateBR(v.toDate());
  if (v instanceof Date) return formatDateBR(v);
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (typeof v === 'object') {
    const out: EntityData = {};
    for (const [k, val] of Object.entries(v as EntityData)) out[k] = normalizeValue(val);
    return out;
  }
  return v;
};

/**
 * Retorna os valores ANTIGOS e NOVOS dos campos que mudaram entre before/after, ignorando
 * campos de bookkeeping. `extraIgnoredKeys` cobre campos de engajamento (curtidas, visualizações,
 * contadores denormalizados) que mudam sem representar uma ação administrativa real.
 */
export const computeChangedFields = (before: EntityData, after: EntityData, extraIgnoredKeys: string[] = []): FieldDiff => {
  const ignoredKeys = extraIgnoredKeys.length > 0 ? new Set([...IGNORED_KEYS, ...extraIgnoredKeys]) : IGNORED_KEYS;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const beforeOut: EntityData = {};
  const afterOut: EntityData = {};
  for (const key of keys) {
    if (ignoredKeys.has(key)) continue;
    const beforeVal = normalizeValue(before[key]);
    const afterVal = normalizeValue(after[key]);
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      beforeOut[key] = beforeVal;
      afterOut[key] = afterVal;
    }
  }
  return { before: beforeOut, after: afterOut };
};

/** Retorna todos os campos de um documento (usado no DELETE), ignorando campos de bookkeeping. */
export const normalizeAllFields = (data: EntityData, extraIgnoredKeys: string[] = []): EntityData => {
  const ignoredKeys = extraIgnoredKeys.length > 0 ? new Set([...IGNORED_KEYS, ...extraIgnoredKeys]) : IGNORED_KEYS;
  const out: EntityData = {};
  for (const [k, v] of Object.entries(data)) {
    if (ignoredKeys.has(k)) continue;
    out[k] = normalizeValue(v);
  }
  return out;
};

/** A frase de cada ação, como CHAVE: o verbo muda de lugar na frase conforme o idioma. */
const ACTION_TEXT_KEYS: Record<AuditAction, string> = {
  CREATE: '@core.admin/audit.text.create',
  UPDATE: '@core.admin/audit.text.update',
  DELETE: '@core.admin/audit.text.delete',
  SYSTEM: '@core.admin/audit.text.system',
};

export const ACTION_TITLE: Record<AuditAction, string> = {
  CREATE: '@core.admin/audit.action.create',
  UPDATE: '@core.admin/audit.action.update',
  DELETE: '@core.admin/audit.action.delete',
  SYSTEM: '@core.admin/audit.action.system',
};

/**
 * O "antes" e o "depois" são marcados por SÍMBOLO, não por rótulo escrito.
 *
 * `−` e `+` são a convenção universal de diff, que é exatamente o que um log de auditoria é: quem
 * lê reconhece sem precisar de palavra, e o bloco atravessa qualquer idioma sem tradução — que era
 * o que prendia o texto inteiro do log ao português.
 */
const BEFORE_MARK = '−';
const AFTER_MARK = '+';
/** O bloco da identidade que o convidado do portal provou ao gravar — símbolo e JSON, como os outros. */
const VERIFIED_MARK = '✓';

const jsonBlock = (mark: string, data: EntityData): string =>
  `\n\n${mark}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

/**
 * Monta o log: a FRASE vira chave, e os blocos de dado entram como parâmetro já pronto.
 * - CREATE: só a frase, sem bloco (nada "mudou" ainda).
 * - UPDATE: bloco `−` com os valores antigos + bloco `+` com os novos, dos campos que mudaram.
 * - DELETE: só bloco `−` com todos os campos do registro excluído (não há "depois").
 * - Gravado pelo portal por quem provou a identidade: um bloco `✓` com o provedor, a claim e o nível.
 *
 * Os blocos podem ser parâmetro porque não têm mais texto dentro: são símbolo e JSON, iguais em
 * qualquer idioma.
 */
/**
 * O `{entity}` da frase NÃO sai daqui: quem sabe como a coleção se chama é a tela instalada no
 * momento em que alguém lê o log, e é a tela de Auditoria que o injeta. Gravar o nome aqui o
 * congelaria no dia da gravação e ainda dependeria de o cache de schema do backend estar quente.
 */
export const buildAuditText = (
  action: AuditAction,
  displayName: string,
  userName: string,
  diff?: { before?: EntityData; after?: EntityData },
  verified?: EntityData | null,
): LocalizedMessage => {
  let blocks = '';
  if (diff?.before && Object.keys(diff.before).length > 0) blocks += jsonBlock(BEFORE_MARK, diff.before);
  if (diff?.after && Object.keys(diff.after).length > 0) blocks += jsonBlock(AFTER_MARK, diff.after);
  if (verified) blocks += jsonBlock(VERIFIED_MARK, verified);

  return {
    message: ACTION_TEXT_KEYS[action],
    messageParams: { user: userName, name: displayName, blocks },
  };
};

export const buildTenantDeletedText = (userName: string, tenantName: string): LocalizedMessage => ({
  message: '@core.admin/audit.text.tenant-deleted',
  messageParams: { user: userName, tenant: tenantName },
});

export const buildErrorText = (
  collection: string,
  docId: string,
  message: string,
): LocalizedMessage => ({
  message: '@core.admin/audit.text.failed',
  messageParams: { path: `${collection}/${docId}`, detail: message },
});

/**
 * DELETE é sempre HIGH. Também é HIGH tudo o que muda QUEM PODE O QUÊ: os perfis de um membro e as
 * permissões de um perfil. São as duas escritas capazes de dar acesso a alguém, e ler o histórico
 * delas depois é justamente o motivo de a auditoria existir.
 */
export const resolveSeverity = (action: AuditAction, collection: string, changedFieldKeys: EntityData): AuditSeverity => {
  if (action === 'DELETE') return 'HIGH';
  if (collection === 'members' && 'roleIds' in changedFieldKeys) return 'HIGH';
  if (collection === 'roles' && 'permissions' in changedFieldKeys) return 'HIGH';
  return 'LOW';
};
