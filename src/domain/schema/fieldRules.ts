// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export type FormatPreset =
  | 'cpf'
  | 'cnpj'
  | 'cpfCnpj'
  | 'phone'
  | 'cep'
  | 'digits'
  | 'trim'
  | 'upper'
  | 'lower';

export type ValidateCheck = 'cpf' | 'cnpj' | 'cpfCnpj';

export interface ValidateRule {
  pattern?: string;
  flags?: string;
  message?: string;
  check?: ValidateCheck;
}

export interface FormatRule {
  preset?: FormatPreset;
  pattern?: string;
  replacement?: string;
  flags?: string;
}

export interface FieldRules {
  validate?: ValidateRule;
  format?: FormatRule;
}

/**
 * Origem externa de dados para preencher campos quando outro campo muda — a alternativa assíncrona
 * ao `onChange`, que é síncrono por ser expressão. O provedor é resolvido por nome no registro
 * montado pelo DIContainer.
 */
export interface FieldLookupBinding {
  provider: string;
  // Prefixo aplicado às chaves devolvidas: 'address' → address.street, address.city…
  targetPrefix?: string | null;
}

export interface FieldLogic {
  validate?: string | null;
  disabledWhen?: string | null;
  hiddenWhen?: string | null;
  compute?: string | null;
  // Front-only: expressão que DEVOLVE um objeto, mesclado no formulário quando o campo muda.
  // Semeia valores que o usuário ainda pode editar — ao contrário de `compute`, que deriva sempre.
  onChange?: string | null;
  onChangeLookup?: FieldLookupBinding | null;
}

// ─── Agregação sobre registros filhos ─────────────────────────────────────────

export type AggregationOp = 'sum' | 'count' | 'avg' | 'min' | 'max';

/**
 * Declara que o valor do campo vem de um agregado sobre os registros FILHOS — o que o `compute`
 * (puro e síncrono, restrito ao próprio registro) não alcança. A dependência é declarada, e não
 * inferida de uma expressão, para que o motor saiba exatamente quando recalcular e para que ciclos
 * entre telas sejam detectáveis na autoria.
 */
export interface FieldAggregation {
  // Tela/entidade dos filhos: screenKey de tela dinâmica ou coleção de entidade fixa.
  from: string;
  // Chave do campo de referência NO FILHO que aponta para este registro.
  via: string;
  op: AggregationOp;
  // Campo do filho medido; ignorado por `count`.
  field?: string | null;
  // Expressão booleana avaliada sobre o filho — só entra no agregado quando verdadeira.
  filter?: string | null;
}

export const AGGREGATION_OP_LABELS: Record<AggregationOp, string> = {
  sum: 'Soma',
  count: 'Contagem',
  avg: 'Média',
  min: 'Menor valor',
  max: 'Maior valor',
};

// ─── Tipos de controle de campo (compartilhados form/list/custom) ─────────────

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'masked'
  | 'reference'
  | 'markdown';

export type CustomFieldMask = 'cpf' | 'cnpj' | 'phone' | 'cep';

export interface CustomFieldOption {
  key: string;
  label: string;
  isStatic?: boolean;
  color?: string;
}

export interface RuleIssue {
  path: string;
  label: string;
  error: string;
}

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

export const formatCpf = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatCnpj = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

export const formatPhoneBr = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const formatCepBr = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

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

export const RULE_PRESET_FORMATTERS: Record<FormatPreset, (value: string) => string> = {
  cpf: formatCpf,
  cnpj: formatCnpj,
  cpfCnpj: (value) => (onlyDigits(value).length > 11 ? formatCnpj(value) : formatCpf(value)),
  phone: formatPhoneBr,
  cep: formatCepBr,
  digits: onlyDigits,
  trim: (value) => value.trim(),
  upper: (value) => value.toUpperCase(),
  lower: (value) => value.toLowerCase(),
};

export const FORMAT_PRESET_LABELS: Record<FormatPreset, string> = {
  cpf: 'CPF (000.000.000-00)',
  cnpj: 'CNPJ (00.000.000/0000-00)',
  cpfCnpj: 'CPF ou CNPJ',
  phone: 'Telefone ((00) 00000-0000)',
  cep: 'CEP (00000-000)',
  digits: 'Somente números',
  trim: 'Remover espaços das pontas',
  upper: 'MAIÚSCULAS',
  lower: 'minúsculas',
};

export const VALIDATE_CHECK_LABELS: Record<ValidateCheck, string> = {
  cpf: 'CPF (dígito verificador)',
  cnpj: 'CNPJ (dígito verificador)',
  cpfCnpj: 'CPF ou CNPJ (dígito verificador)',
};

export const isEmptyRuleValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const buildRegExp = (pattern: string, flags?: string): RegExp | null => {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
};

export const applyFormat = (value: unknown, rule: FormatRule | undefined): unknown => {
  if (!rule || typeof value !== 'string') return value;

  let next = value;
  if (rule.preset) next = RULE_PRESET_FORMATTERS[rule.preset]?.(next) ?? next;

  if (rule.pattern) {
    const regex = buildRegExp(rule.pattern, rule.flags);
    if (regex) next = next.replace(regex, rule.replacement ?? '');
  }

  return next;
};

const runCheck = (check: ValidateCheck, value: string): boolean => {
  switch (check) {
    case 'cpf':
      return isValidCpf(value);
    case 'cnpj':
      return isValidCnpj(value);
    case 'cpfCnpj':
      return isValidCpf(value) || isValidCnpj(value);
    default:
      return true;
  }
};

const DEFAULT_CHECK_MESSAGES: Record<ValidateCheck, string> = {
  cpf: 'CPF inválido',
  cnpj: 'CNPJ inválido',
  cpfCnpj: 'CPF ou CNPJ inválido',
};

export const checkValue = (
  value: unknown,
  rule: ValidateRule | undefined,
  label: string,
): string | undefined => {
  if (!rule || isEmptyRuleValue(value)) return undefined;

  const text = typeof value === 'string' ? value : String(value);

  if (rule.check && !runCheck(rule.check, text)) {
    return rule.message ?? DEFAULT_CHECK_MESSAGES[rule.check];
  }

  if (rule.pattern) {
    const regex = buildRegExp(rule.pattern, rule.flags);
    if (regex && !regex.test(text)) {
      return rule.message ?? `O campo "${label}" está em um formato inválido`;
    }
  }

  return undefined;
};

export interface FormatAndValidateOutcome {
  value: unknown;
  issue?: RuleIssue;
}

export const formatAndValidate = (
  value: unknown,
  rules: FieldRules | undefined | null,
  path: string,
  label: string,
): FormatAndValidateOutcome => {
  if (!rules) return { value };

  const formatted = applyFormat(value, rules.format);
  const error = checkValue(formatted, rules.validate, label);

  return error ? { value: formatted, issue: { path, label, error } } : { value: formatted };
};

export const describeRuleIssues = (issues: RuleIssue[]): string =>
  issues.map((issue) => `${issue.label}: ${issue.error}`).join('; ');

/**
 * `pattern`/`patternMessage` do InputDefinition antecedem FieldRules e continuam válidos.
 * Aqui eles são lidos como um `validate` equivalente; `rules.validate` explícito tem prioridade.
 */
export interface LegacyPatternSource {
  pattern?: string;
  patternMessage?: string;
  rules?: FieldRules;
}

export const toEffectiveRules = (source: LegacyPatternSource): FieldRules | undefined => {
  const validate = source.rules?.validate ?? (
    source.pattern ? { pattern: source.pattern, message: source.patternMessage } : undefined
  );
  const format = source.rules?.format;
  if (!validate && !format) return undefined;
  return { ...(validate ? { validate } : {}), ...(format ? { format } : {}) };
};
