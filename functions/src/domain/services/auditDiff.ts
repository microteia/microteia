import type { AuditAction, AuditSeverity } from '../entities/AuditLog';

type EntityData = Record<string, unknown>;

export interface FieldDiff {
  before: EntityData;
  after: EntityData;
}

const IGNORED_KEYS = new Set(['updatedAt', 'updatedBy', 'updatedByName', 'updatedByPhotoURL', 'id', 'tenantId']);

const isTimestampLike = (v: unknown): v is { toDate: () => Date } =>
  !!v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function';

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

const ACTION_VERB: Record<AuditAction, string> = {
  CREATE: 'criou',
  UPDATE: 'alterou',
  DELETE: 'excluiu',
  SYSTEM: 'processou',
};

export const ACTION_TITLE: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  SYSTEM: 'Sistema',
};

/**
 * Monta o Markdown do log: frase descritiva + (quando houver) blocos json.
 * - CREATE: só a frase, sem bloco (nada "mudou" ainda).
 * - UPDATE: bloco **Antes:** com os valores antigos + bloco **Depois:** com os valores novos
 *   dos campos que mudaram.
 * - DELETE: só bloco **Antes:** com todos os campos do registro excluído (não há "depois").
 */
export const buildAuditText = (
  action: AuditAction,
  entityLabel: string,
  displayName: string,
  userName: string,
  diff?: { before?: EntityData; after?: EntityData },
): string => {
  let text = `O usuário **${userName}** ${ACTION_VERB[action]} ${entityLabel.toLowerCase()} **${displayName}**.`;

  if (diff?.before && Object.keys(diff.before).length > 0) {
    text += `\n\n**Antes:**\n\`\`\`json\n${JSON.stringify(diff.before, null, 2)}\n\`\`\``;
  }
  if (diff?.after && Object.keys(diff.after).length > 0) {
    text += `\n\n**Depois:**\n\`\`\`json\n${JSON.stringify(diff.after, null, 2)}\n\`\`\``;
  }

  return text;
};

export const buildTenantDeletedText = (userName: string, tenantName: string): string =>
  `O usuário **${userName}** excluiu o escritório **${tenantName}**, removendo todos os dados vinculados.`;

export const buildErrorText = (collection: string, docId: string, message: string): string =>
  `Falha ao processar auditoria para \`${collection}/${docId}\`.\n\n\`\`\`\n${message}\n\`\`\``;

/** DELETE é sempre HIGH; mudança de role de membro é HIGH; demais casos ficam no default LOW. */
export const resolveSeverity = (action: AuditAction, collection: string, changedFieldKeys: EntityData): AuditSeverity => {
  if (action === 'DELETE') return 'HIGH';
  if (collection === 'members' && 'role' in changedFieldKeys) return 'HIGH';
  return 'LOW';
};
