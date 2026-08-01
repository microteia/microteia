// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/fieldRulePresets.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldRulePresets.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CustomFieldType } from './fieldRules';

/**
 * O kernel conhece VERBOS (os primitivos abaixo); o vocabulário de negócio — CPF, CNPJ, CEP, RG,
 * placa — é SUBSTANTIVO e vive em declarações de plugin. Acrescentar uma máscara ou uma validação
 * nova é publicar uma Extensão que contribui para `data.fieldRulePreset`, nunca um commit aqui.
 *
 * Por isso todo preset é DADO puro, sem código: é o que garante que a mesma regra produza o mesmo
 * resultado no browser e na Cloud Function, para qualquer tenant, sem exigir extensão trusted.
 */
export type FormatOp =
  | { op: 'digits' }
  | { op: 'letters' }
  | { op: 'alphanumeric' }
  | { op: 'trim' }
  | { op: 'upper' }
  | { op: 'lower' }
  | { op: 'mask'; templates: string[] }
  | { op: 'regex'; pattern: string; replacement?: string; flags?: string }
  | { op: 'expression'; expression: string };

export interface FieldRulePresetMask {
  templates: string[];
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}

export interface FieldRulePresetValidate {
  expression?: string;
  pattern?: string;
  flags?: string;
  message?: string;
}

export interface FieldRulePreset {
  // Chave sem `/` é reservada ao núcleo; extensão usa namespace: 'com.acme.docs/rg-sp'.
  key: string;
  label: string;
  // Restringe onde o preset aparece na autoria. Ausente = serve a qualquer tipo de campo.
  appliesTo?: CustomFieldType[];
  mask?: FieldRulePresetMask;
  format?: FormatOp[];
  validate?: FieldRulePresetValidate;
}

export type FieldRulePresetCatalog = ReadonlyMap<string, FieldRulePreset>;

// ─── Primitivos de texto ──────────────────────────────────────────────────────

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

const onlyLetters = (value: string): string => value.replace(/[^A-Za-zÀ-ÿ]/g, '');

const onlyAlphanumeric = (value: string): string => value.replace(/[^0-9A-Za-zÀ-ÿ]/g, '');

export const isEmptyRuleValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

export const buildRegExp = (pattern: string, flags?: string): RegExp | null => {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
};

// ─── Motor genérico de máscara por template ───────────────────────────────────

const DIGIT_SLOT = '#';
const LETTER_SLOT = 'A';
const ALNUM_SLOT = '*';

const isSlot = (char: string): boolean =>
  char === DIGIT_SLOT || char === LETTER_SLOT || char === ALNUM_SLOT;

const matchesSlot = (char: string, slot: string): boolean => {
  if (slot === DIGIT_SLOT) return /\d/.test(char);
  if (slot === LETTER_SLOT) return /[A-Za-zÀ-ÿ]/.test(char);
  return /[0-9A-Za-zÀ-ÿ]/.test(char);
};

const slotCount = (template: string): number =>
  [...template].filter(isSlot).length;

/**
 * Um mesmo campo pode ter mais de um formato válido conforme o tamanho — telefone com 10 ou 11
 * dígitos, CPF ou CNPJ no mesmo campo. Em vez de um `if` de tamanho no kernel, a escolha é
 * declarada: vence o primeiro template que comporta o conteúdo, e o último quando nenhum comporta.
 */
const pickTemplate = (value: string, templates: string[]): string | undefined => {
  const available = templates.filter((template) => template.length > 0);
  if (available.length === 0) return undefined;
  const length = onlyAlphanumeric(value).length;
  return available.find((template) => slotCount(template) >= length) ?? available[available.length - 1];
};

/**
 * Aplicação PROGRESSIVA: entrada parcial produz saída parcial, e o separador só aparece quando há
 * conteúdo depois dele — é o que permite digitar e apagar sem que a máscara empurre o cursor.
 */
export const applyMaskTemplate = (value: string, templates: string[]): string => {
  const template = pickTemplate(value, templates);
  if (!template) return value;

  const source = [...value];
  let cursor = 0;
  let result = '';

  for (const char of template) {
    if (isSlot(char)) {
      while (cursor < source.length && !matchesSlot(source[cursor], char)) cursor += 1;
      if (cursor >= source.length) break;
      result += source[cursor];
      cursor += 1;
      continue;
    }
    if (cursor >= source.length) break;
    result += char;
  }

  return result;
};

export const maskPlaceholder = (mask: FieldRulePresetMask): string => {
  if (mask.placeholder) return mask.placeholder;
  const template = mask.templates.find((candidate) => candidate.length > 0) ?? '';
  return [...template].map((char) => (char === DIGIT_SLOT ? '0' : char)).join('');
};

// ─── Execução do pipeline de formatação ───────────────────────────────────────

export type FieldExpressionRunner = (expression: string, value: string) => unknown;

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

/**
 * Falha de op é NO-OP, nunca exceção: uma regex inválida ou uma expressão quebrada num preset não
 * pode impedir a gravação de um registro. O erro é reportado como diagnóstico na autoria.
 */
export const applyFormatOps = (
  value: string,
  ops: FormatOp[] | undefined,
  runExpression?: FieldExpressionRunner,
): string => {
  if (!ops || ops.length === 0) return value;

  return ops.reduce<string>((current, op) => {
    switch (op.op) {
      case 'digits':
        return onlyDigits(current);
      case 'letters':
        return onlyLetters(current);
      case 'alphanumeric':
        return onlyAlphanumeric(current);
      case 'trim':
        return current.trim();
      case 'upper':
        return current.toUpperCase();
      case 'lower':
        return current.toLowerCase();
      case 'mask':
        return applyMaskTemplate(current, op.templates);
      case 'regex': {
        const regex = buildRegExp(op.pattern, op.flags);
        return regex ? current.replace(regex, op.replacement ?? '') : current;
      }
      case 'expression': {
        if (!runExpression) return current;
        try {
          return asText(runExpression(op.expression, current));
        } catch {
          return current;
        }
      }
      default:
        return current;
    }
  }, value);
};

// ─── Dígitos verificadores expostos ao catálogo de expressões ─────────────────

export const isValidCpf = (value: string): boolean => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf.charAt(index)) * (10 - index);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(cpf.charAt(9))) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf.charAt(index)) * (11 - index);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(cpf.charAt(10));
};

export const isValidCnpj = (value: string): boolean => {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let sum = 0;
  let weight = 5;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(cnpj.charAt(index)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== Number(cnpj.charAt(12))) return false;

  sum = 0;
  weight = 6;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(cnpj.charAt(index)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return digit === Number(cnpj.charAt(13));
};

// ─── Templates de máscara do Brasil ───────────────────────────────────────────

/**
 * Os templates e os formatadores do BRASIL. A DECLARAÇÃO que os usa vive na extensão
 * (`plugins/marketplace/brasil.ts`); o que sobra aqui são as funções — `formatCpf` e companhia
 * ainda são chamadas por `utils/formatters.ts`, e o teste-oráculo as compara com o motor genérico.
 * Saem daqui quando o último consumidor em código sair.
 */

export const CPF_TEMPLATE = '###.###.###-##';
export const CNPJ_TEMPLATE = '##.###.###/####-##';
export const PHONE_TEMPLATES = ['(##) ####-####', '(##) #####-####'];
export const CEP_TEMPLATE = '#####-###';

export const formatCpf = (value: string): string => applyMaskTemplate(value, [CPF_TEMPLATE]);

export const formatCnpj = (value: string): string => applyMaskTemplate(value, [CNPJ_TEMPLATE]);

export const formatPhoneBr = (value: string): string => applyMaskTemplate(value, PHONE_TEMPLATES);

export const formatCepBr = (value: string): string => applyMaskTemplate(value, [CEP_TEMPLATE]);

// ─── Catálogo do núcleo ───────────────────────────────────────────────────────

/**
 * O que o núcleo declara: transformações de texto que valem em qualquer país e em qualquer negócio.
 * Máscara e validação de documento, telefone ou código postal NÃO entram aqui — são de país, e
 * chegam por extensão.
 */
export const CORE_FIELD_RULE_PRESETS: FieldRulePreset[] = [
  { key: 'digits', label: 'Somente números', format: [{ op: 'digits' }] },
  { key: 'trim', label: 'Remover espaços das pontas', format: [{ op: 'trim' }] },
  { key: 'upper', label: 'MAIÚSCULAS', format: [{ op: 'upper' }] },
  { key: 'lower', label: 'minúsculas', format: [{ op: 'lower' }] },
];

export interface FieldRulePresetConflict {
  key: string;
  ignored: FieldRulePreset;
}

/**
 * Chave já ocupada NÃO é sobrescrita — uma extensão não pode redefinir o que `cpf` significa para as
 * telas que já dependem dele. Espelha a política de `extensionPoint.duplicate` do Kernel.
 */
export const buildFieldRulePresetCatalog = (
  presets: Iterable<FieldRulePreset> = [],
  conflicts?: FieldRulePresetConflict[],
): FieldRulePresetCatalog => {
  const catalog = new Map<string, FieldRulePreset>();
  for (const preset of [...CORE_FIELD_RULE_PRESETS, ...presets]) {
    if (!preset?.key) continue;
    if (catalog.has(preset.key)) {
      conflicts?.push({ key: preset.key, ignored: preset });
      continue;
    }
    catalog.set(preset.key, preset);
  }
  return catalog;
};

export const CORE_FIELD_RULE_PRESET_CATALOG: FieldRulePresetCatalog = buildFieldRulePresetCatalog();
