import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import { LOOKUP_SEED_MODES, isLookupSeedMode } from '../../schema/lookupSeed';
import {
  SCREEN_SEED_KEY_PATTERN,
  SCREEN_SEED_MAX_RECORDS,
  SCREEN_SEED_SINCE_KERNEL,
  SCREEN_SEED_TEXT_TYPES,
} from '../../schema/screenSeed';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../schema/i18n/extensionPoints';
import { parseMessageRef } from '../../schema/i18n/messageRef';
import { planRecordKeys, scopeRecordKeys } from '../../schema/recordKeys';
import type { RecordKeySpec } from '../../schema/recordKeys';
import { fieldUniqueKeyName } from '../../schema/screenEntity';
import { isEmptyRuleValue } from '../../schema/fieldRulePresets';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O que a semente não pode escrever: o que a gravação não aceita de ninguém (o agregado, o derivado, o
 * calculado, o número da sequência) — a recusa viria só no escritório, registro a registro.
 */
const isUnwritable = (field: TemplateField): boolean =>
  !!field.aggregation || !!field.logic?.derive || !!field.logic?.compute || !!field.autoValue?.sequence;

/**
 * Referência e arquivo ficam de fora desta versão. A referência guarda o id do registro apontado, que
 * só existe no escritório — uma semente que apontasse para outra semente precisaria de um endereço que
 * o pacote não tem. O arquivo, de um conteúdo que o pacote não carrega.
 */
const UNSUPPORTED_TYPES: ReadonlySet<string> = new Set(['reference', 'file']);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** A forma que o valor tem de ter, escrita como o autor a escreveria — e por isso igual em todo idioma. */
const expectedShape = (field: TemplateField): string | null => {
  switch (field.type) {
    case 'number':
    case 'currency':
      return 'number';
    case 'checkbox':
      return 'boolean';
    case 'date':
      return '"YYYY-MM-DD"';
    case 'time':
      return '"HH:mm"';
    case 'select':
      return field.multi ? 'string[]' : 'string';
    default:
      return 'string';
  }
};

const matchesShape = (field: TemplateField, value: unknown): boolean => {
  switch (field.type) {
    case 'number':
    case 'currency':
      return typeof value === 'number' && Number.isFinite(value);
    case 'checkbox':
      return typeof value === 'boolean';
    case 'date':
      return typeof value === 'string' && DATE.test(value);
    case 'time':
      return typeof value === 'string' && TIME.test(value);
    case 'select':
      return field.multi
        ? Array.isArray(value) && value.every((item) => typeof item === 'string')
        : typeof value === 'string';
    default:
      return typeof value === 'string';
  }
};

/**
 * As opções que o campo de seleção aceita, quando o pacote as conhece: as do próprio campo, ou as que o
 * pacote semeia na lista que o campo usa. Lista da plataforma ou de outra extensão não se confere daqui
 * — `null`, e o valor passa.
 */
const knownOptionKeys = (field: TemplateField, pkg: MarketplacePlugin): ReadonlySet<string> | null => {
  if ((field.options?.length ?? 0) > 0) return new Set(field.options!.map((option) => option.key));
  if (!field.lookupCollection) return null;
  const lookup = (pkg.lookups ?? []).find((candidate) => candidate.collection === field.lookupCollection);
  return lookup && (lookup.options?.length ?? 0) > 0 ? new Set(lookup.options!.map((option) => option.key)) : null;
};

/** As referências que o pacote resolve sozinho: as chaves dos `i18n.messages` que ele mesmo traz. */
const packageMessageRefs = (pkg: MarketplacePlugin): ReadonlySet<string> => {
  const own = (pkg.manifest.contributes ?? []).filter((contribution) => contribution?.point === I18N_MESSAGES_POINT);
  return new Set(messageBundlesOf(own).flatMap((bundle) =>
    Object.keys(bundle.messages).map((key) => `${bundle.namespace}/${key}`)));
};

/** As chaves da coleção como a gravação as aplica: as declaradas vencem o açúcar `field.unique`. */
const screenKeys = (screen: ScreenModuleTemplate): RecordKeySpec[] => {
  const declared = screen.keys ?? [];
  const names = new Set(declared.map((key) => key.name));
  const sugar = (screen.fields ?? [])
    .filter((field) => field.unique === true && !names.has(fieldUniqueKeyName(field.key)))
    .map((field): RecordKeySpec => ({ name: fieldUniqueKeyName(field.key), kind: 'unique', fields: [field.key] }));
  return [...declared, ...sugar];
};

const valueIssues = (
  screen: ScreenModuleTemplate,
  recordKey: string,
  field: TemplateField,
  value: unknown,
  pkg: MarketplacePlugin,
  messages: ReadonlySet<string>,
): LocalizedIssue[] => {
  const params = { screen: screen.key, key: recordKey, field: field.key };
  if (UNSUPPORTED_TYPES.has(field.type)) return [{ message: '@core.marketplace/issue.screen-seed.field-unsupported', messageParams: { ...params, type: field.type } }];
  if (isUnwritable(field)) return [{ message: '@core.marketplace/issue.screen-seed.field-unwritable', messageParams: params }];
  if (value === null || value === undefined) return [];

  const ref = parseMessageRef(value);
  if (ref) {
    if (!SCREEN_SEED_TEXT_TYPES.has(field.type)) return [{ message: '@core.marketplace/issue.screen-seed.message-field', messageParams: { ...params, ref: ref.full } }];
    return messages.has(ref.full) ? [] : [{ message: '@core.marketplace/issue.screen-seed.message-missing', messageParams: { ...params, ref: ref.full } }];
  }
  if (!matchesShape(field, value)) {
    return [{ message: '@core.marketplace/issue.screen-seed.field-type', messageParams: { ...params, expected: expectedShape(field) ?? field.type } }];
  }
  if (field.type !== 'select') return [];
  const options = knownOptionKeys(field, pkg);
  if (!options) return [];
  const unknown = (Array.isArray(value) ? value : [value]).find((item) => !options.has(item as string));
  return unknown === undefined ? [] : [{ message: '@core.marketplace/issue.screen-seed.option', messageParams: { ...params, value: String(unknown) } }];
};

const screenSeedIssues = (screen: ScreenModuleTemplate, pkg: MarketplacePlugin, messages: ReadonlySet<string>): LocalizedIssue[] => {
  const seed: unknown = screen.seed;
  if (seed === undefined || seed === null) return [];
  if (!isPlainObject(seed) || !Array.isArray(seed.records)) {
    return [{ message: '@core.marketplace/issue.screen-seed.shape', messageParams: { screen: screen.key } }];
  }
  const issues: LocalizedIssue[] = [];
  if (seed.mode !== undefined && !isLookupSeedMode(seed.mode)) {
    issues.push({
      message: '@core.marketplace/issue.screen-seed.mode',
      messageParams: { screen: screen.key, mode: String(seed.mode), expected: LOOKUP_SEED_MODES.join(', ') },
    });
  }
  if (seed.records.length > SCREEN_SEED_MAX_RECORDS) {
    issues.push({
      message: '@core.marketplace/issue.screen-seed.too-many',
      messageParams: { screen: screen.key, count: String(seed.records.length), max: String(SCREEN_SEED_MAX_RECORDS) },
    });
  }

  const fields = new Map((screen.fields ?? []).map((field) => [field.key, field]));
  const keys = scopeRecordKeys(screenKeys(screen), screen.parentFieldKey ?? null);
  const seenKeys = new Set<string>();
  const keyHolders = new Map<string, string>();

  for (const record of seed.records as unknown[]) {
    if (!isPlainObject(record) || typeof record.key !== 'string' || !SCREEN_SEED_KEY_PATTERN.test(record.key)) {
      const key = isPlainObject(record) ? String(record.key ?? '') : '';
      issues.push({ message: '@core.marketplace/issue.screen-seed.key', messageParams: { screen: screen.key, key } });
      continue;
    }
    const recordKey = record.key;
    if (seenKeys.has(recordKey)) {
      issues.push({ message: '@core.marketplace/issue.screen-seed.duplicate', messageParams: { screen: screen.key, key: recordKey } });
      continue;
    }
    seenKeys.add(recordKey);
    if (!isPlainObject(record.data)) {
      issues.push({ message: '@core.marketplace/issue.screen-seed.data', messageParams: { screen: screen.key, key: recordKey } });
      continue;
    }
    const data = record.data;

    for (const [fieldKey, value] of Object.entries(data)) {
      const field = fields.get(fieldKey);
      if (!field) {
        issues.push({ message: '@core.marketplace/issue.screen-seed.field-unknown', messageParams: { screen: screen.key, key: recordKey, field: fieldKey } });
        continue;
      }
      issues.push(...valueIssues(screen, recordKey, field, value, pkg, messages));
    }

    for (const field of fields.values()) {
      if (!field.required || isUnwritable(field) || UNSUPPORTED_TYPES.has(field.type)) continue;
      if (field.defaultValue !== undefined && field.defaultValue !== null) continue;
      if (isEmptyRuleValue(data[field.key])) {
        issues.push({ message: '@core.marketplace/issue.screen-seed.required', messageParams: { screen: screen.key, key: recordKey, field: field.key } });
      }
    }

    // Duas sementes com o mesmo valor numa chave declarada: a segunda seria recusada no escritório, e
    // contada como "já existia" — o catálogo chegaria sem ela, sem que ninguém soubesse por quê.
    for (const entry of planRecordKeys(keys, data, screen.key).entries) {
      const holder = keyHolders.get(entry.keyId);
      if (holder === undefined) {
        keyHolders.set(entry.keyId, recordKey);
        continue;
      }
      issues.push({
        message: '@core.marketplace/issue.screen-seed.key-repeated',
        messageParams: { screen: screen.key, key: recordKey, other: holder, name: entry.name },
      });
    }
  }
  return issues;
};

/**
 * As sementes das telas do pacote, conferidas contra os campos da própria tela: o que o `check` recusa
 * aqui só apareceria no escritório, depois de instalar, como uma semente que não entrou.
 *
 * O `kernel` é de GARANTIA, como o das listas: um kernel anterior ignora `seed` em silêncio, e a
 * extensão instalaria sem o catálogo de que as telas dela dependem.
 */
export const packageScreenSeedIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const screens = pkg.screens ?? [];
  const seeded = screens.filter((screen) => screen.seed !== undefined && screen.seed !== null);
  if (seeded.length === 0) return [];

  const messages = packageMessageRefs(pkg);
  const issues = seeded.flatMap((screen) => screenSeedIssues(screen, pkg, messages));
  if (!rangeExcludesBelow(pkg.manifest.kernel ?? '', SCREEN_SEED_SINCE_KERNEL)) {
    issues.push({ message: '@core.marketplace/issue.screen-seed.kernel', messageParams: { screen: seeded[0].key, minimum: SCREEN_SEED_SINCE_KERNEL } });
  }
  return issues;
};
