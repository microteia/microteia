import type { InputMapping } from '../entities/Workflow';
import type { EntityKey, NativeFieldType } from './entityRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';
import { resolveQueryTable } from './querySpec';
import { isLookupTable, resolveRecordSequences } from './screenEntity';
import { recordSequenceFields } from './recordSequence';
import { DEFAULT_TIME_ZONE, dayInTimeZone } from './i18n/timeZone';
import { RECORD_PORTAL_VERIFIED_FIELD } from './portalIdentity';

export interface UpsertSpec {
  table: string;
  id?: string;
  data: Record<string, unknown>;
}

export interface RemoveSpec {
  table: string;
  id: string;
}

export interface UpsertStepConfig {
  table: string;
  source: 'input' | 'event';
  property?: string;
}

export interface RemoveStepConfig {
  table: string;
  id: InputMapping;
}

export const setValueAtPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const next = cursor[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
};

export type WritableTableKind = 'entity' | 'lookup';

export interface ResolvedWritableTable {
  kind: WritableTableKind;
  physicalCollection: string;
  entityKey?: EntityKey;
  root: PathRoot;
}

export type WritableTableOutcome =
  | { ok: true; value: ResolvedWritableTable }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

/**
 * Entidades legíveis mas NUNCA graváveis por automação: são mantidas por fluxos próprios com
 * invariantes que uma automação não respeitaria (limite de membros, publicação).
 * Uma DENYLIST, e não uma allowlist: qualquer tela nova é gravável por padrão.
 */
const NON_WRITABLE_ENTITY_KEYS: ReadonlySet<EntityKey> = new Set<EntityKey>([
  'members',
]);

export const LOOKUP_WRITABLE_FIELDS: readonly string[] = ['key', 'label', 'color'];

/**
 * POR ONDE a gravação entrou: o app (`ui`), um agente de IA pelo MCP (`agent`), uma automação sem
 * pessoa por trás (`automation`) ou um convidado de FORA do escritório, pelo portal (`portal`). Mora num campo À PARTE do autor — `createdBy` continua sendo o uid de
 * quem responde pela gravação, porque é o único valor que a auditoria resolve em nome.
 */
export type RecordWriteVia = 'ui' | 'agent' | 'automation' | 'portal';

export const RECORD_CREATED_VIA_FIELD = 'createdVia';
export const RECORD_UPDATED_VIA_FIELD = 'updatedVia';

export const SYSTEM_MANAGED_KEYS: ReadonlySet<string> = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'createdByName',
  'createdByPhotoURL',
  RECORD_CREATED_VIA_FIELD,
  'updatedBy',
  'updatedByName',
  'updatedByPhotoURL',
  RECORD_UPDATED_VIA_FIELD,
  RECORD_PORTAL_VERIFIED_FIELD,
  'deletedBy',
  'deletedByName',
  'deletedByPhotoURL',
]);

export const resolveWritableTable = (table: string, ctx: SchemaContext): WritableTableOutcome => {
  const resolved = resolveQueryTable(table, ctx);
  if (!resolved) {
    return { ok: false, error: '@core.automation/mutation.table.unknown', errorParams: { table } };
  }

  if (isLookupTable(ctx, table)) {
    return { ok: true, value: { kind: 'lookup', physicalCollection: table, root: resolved.root } };
  }

  if (NON_WRITABLE_ENTITY_KEYS.has(table)) {
    return {
      ok: false,
      error: '@core.automation/mutation.table.read-only',
      errorParams: { table },
    };
  }

  return {
    ok: true,
    value: { kind: 'entity', physicalCollection: table, entityKey: table, root: resolved.root },
  };
};

export interface MutationSpecIssue {
  field: string;
  /** REFERÊNCIA de mensagem: a validação roda também no backend, que não conhece idioma. */
  error: string;
  errorParams?: Record<string, string>;
}

export interface WriteLeaf {
  path: string;
  value: unknown;
}

export const flattenDataLeaves = (data: unknown, prefix = ''): WriteLeaf[] => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return prefix ? [{ path: prefix, value: data }] : [];
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return prefix ? [{ path: prefix, value: data }] : [];
  return entries.flatMap(([key, value]) => flattenDataLeaves(value, prefix ? `${prefix}.${key}` : key));
};

type PathIssue = { error: string; errorParams?: Record<string, string> };

const checkWritablePath = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
): PathIssue | undefined => {
  const segments = parsePath(path);
  if (segments.length === 0) return { error: '@core.automation/mutation.path.missing' };

  const top = segments[0].kind === 'key' ? segments[0].name : String(segments[0].index);
  if (SYSTEM_MANAGED_KEYS.has(top)) {
    return {
      error: '@core.automation/mutation.path.system-managed',
      errorParams: { field: top },
    };
  }

  // O número que o sistema atribui ao criar não se escreve por porta nenhuma — nem ao criar (quem
  // numera é a transação da gravação), nem depois (o número é imutável). Recusar aqui, e não
  // descartar em silêncio, é o que diz ao autor da automação que o valor dele nunca seria gravado.
  const numbered = root.kind === 'entity'
    ? resolveRecordSequences(ctx, root.entityKey)
    : recordSequenceFields(root.fields, null);
  if (numbered.some((field) => field.key === top)) {
    return {
      error: '@core.automation/mutation.path.sequence-assigned',
      errorParams: { field: top },
    };
  }

  const resolution = resolvePath(ctx, root, segments);
  if (!resolution.valid) {
    return resolution.error
      ? { error: resolution.error, errorParams: resolution.errorParams }
      : { error: '@core.automation/mutation.path.invalid', errorParams: { path } };
  }
  if (resolution.node.kind === 'unknown') {
    return {
      error: '@core.automation/mutation.path.unknown-field',
      errorParams: { path },
    };
  }
  if (resolution.hops.some((hop) => hop.atPath !== path)) {
    return {
      error: '@core.automation/mutation.path.through-reference',
      errorParams: { path },
    };
  }
  return undefined;
};

export const validateUpsertSpec = (spec: UpsertSpec, ctx: SchemaContext): MutationSpecIssue[] => {
  const issues: MutationSpecIssue[] = [];

  const outcome = resolveWritableTable(spec.table, ctx);
  if (!outcome.ok) {
    issues.push({ field: 'table', error: outcome.error, errorParams: outcome.errorParams });
    return issues;
  }
  const resolved = outcome.value;

  if (spec.id !== undefined && (typeof spec.id !== 'string' || spec.id.trim() === '')) {
    issues.push({ field: 'id', error: '@core.automation/mutation.id.invalid' });
  }

  if (!spec.data || typeof spec.data !== 'object' || Array.isArray(spec.data)) {
    issues.push({ field: 'data', error: '@core.automation/mutation.data.missing' });
    return issues;
  }

  const leaves = flattenDataLeaves(spec.data);
  if (leaves.length === 0) {
    issues.push({ field: 'data', error: '@core.automation/mutation.data.empty' });
    return issues;
  }

  if (resolved.kind === 'lookup') {
    for (const leaf of leaves) {
      if (leaf.path.includes('.') || !LOOKUP_WRITABLE_FIELDS.includes(leaf.path)) {
        issues.push({
          field: `data.${leaf.path}`,
          error: '@core.automation/mutation.lookup.field-not-writable',
          errorParams: { path: leaf.path },
        });
      }
    }
    return issues;
  }

  for (const leaf of leaves) {
    const issue = checkWritablePath(ctx, resolved.root, leaf.path);
    if (issue) issues.push({ field: `data.${leaf.path}`, ...issue });
  }

  return issues;
};

export const validateWritablePath = (
  ctx: SchemaContext,
  table: string,
  path: string,
): PathIssue | undefined => {
  if (!path.trim()) return { error: '@core.automation/mutation.path.required' };
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok) return { error: outcome.error, errorParams: outcome.errorParams };
  const resolved = outcome.value;
  if (resolved.kind === 'lookup') {
    return path.includes('.') || !LOOKUP_WRITABLE_FIELDS.includes(path)
      ? {
          error: '@core.automation/mutation.lookup.field-not-writable',
          errorParams: { path },
        }
      : undefined;
  }
  return checkWritablePath(ctx, resolved.root, path);
};

export const validateRemoveSpec = (spec: RemoveSpec, ctx: SchemaContext): MutationSpecIssue[] => {
  const issues: MutationSpecIssue[] = [];

  const outcome = resolveWritableTable(spec.table, ctx);
  if (!outcome.ok) {
    issues.push({ field: 'table', error: outcome.error, errorParams: outcome.errorParams });
  }
  if (typeof spec.id !== 'string' || spec.id.trim() === '') {
    issues.push({ field: 'id', error: '@core.automation/mutation.remove.id.missing' });
  }

  return issues;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A hora em que um DIA vira instante.
 *
 * "2026-08-12" é o formato do campo de data e nomeia um DIA, não um instante — mas só instante se
 * grava, e alguém tem de escolher a hora. Meia-noite não serve, por dois motivos que se somam:
 * montada em UTC (o fuso de quem executa no SERVIDOR) ela cai no dia anterior do escritório — o
 * prazo digitado 12/08 voltava 11/08 —, e montada no fuso de quem grava o mesmo dia vira dois
 * instantes diferentes conforme a gravação venha da tela ou de uma automação.
 *
 * MEIO-DIA EM UTC é o único instante que se lê como o mesmo dia em qualquer escritório entre UTC-11
 * e UTC+11, e é o mesmo dos dois lados da fronteira. Datas gravadas antes desta regra (meia-noite
 * local) continuam se lendo no dia certo — o que muda é só onde as novas caem.
 */
const DAY_ANCHOR_UTC_HOUR = 12;

/**
 * A data-só-dia como instante, ou `null` quando o texto não é um dia puro. É o ponto ÚNICO dessa
 * conversão: o campo do formulário, o parâmetro de um fluxo e o valor que a IA preenche entram
 * todos por aqui.
 */
export const parseDateOnly = (text: string): Date | null => {
  const dayOnly = DATE_ONLY_PATTERN.exec(text.trim());
  if (!dayOnly) return null;
  return new Date(
    Date.UTC(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]), DAY_ANCHOR_UTC_HOUR),
  );
};

/**
 * O DIA em que um instante cai NO FUSO dado, na mesma âncora — o que `today()` devolve a uma
 * automação. O fuso é o do escritório: às 22h em Brasília o dia ainda é o de hoje, embora UTC já
 * tenha virado a página.
 */
export const anchorDay = (instant: Date, timeZone: string = DEFAULT_TIME_ZONE): Date => {
  const [year, month, day] = dayInTimeZone(instant, timeZone).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, DAY_ANCHOR_UTC_HOUR));
};

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  !!value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function';

export const coerceWriteValue = (type: NativeFieldType | undefined, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'date': {
      if (value instanceof Date) return value;
      if (isTimestampLike(value)) return value.toDate();
      if (typeof value === 'number') return new Date(value);
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        const dayOnly = parseDateOnly(trimmed);
        if (dayOnly) return dayOnly;
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? value : parsed;
      }
      return value;
    }
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
      return value;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1) return true;
      if (value === 'false' || value === 0) return false;
      return value;
    }
    case 'stringArray':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
};

export const resolveLeafType = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
): NativeFieldType | undefined => {
  const resolution = resolvePath(ctx, root, parsePath(path));
  return resolution.node.kind === 'scalar' ? resolution.node.type : undefined;
};
