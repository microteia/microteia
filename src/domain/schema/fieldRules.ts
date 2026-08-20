// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  FieldExpressionRunner,
  FieldRulePreset,
  FieldRulePresetCatalog,
} from './fieldRulePresets';
import {
  applyFormatOps,
  buildRegExp,
  CORE_FIELD_RULE_PRESET_CATALOG,
  isEmptyRuleValue,
} from './fieldRulePresets';
import { evaluateFieldBoolean, evaluateFieldExpression } from './fieldExpression';

/**
 * Onde a tela ou o campo foi DECLARADO — e nada além disso. É a única diferença que resta entre uma
 * tela fixa, uma de extensão e uma do Form Design: a gravação, a resolução de caminhos, as
 * automações e os formulários tratam as três de forma idêntica.
 *
 * `builtin` (declarado em `entityRegistry.ts`) e `plugin` (declarado no pacote da extensão) não
 * podem ser EXCLUÍDOS pelo usuário; todas as demais configurações são livremente alteráveis.
 */
export type FieldOrigin = 'builtin' | 'plugin' | 'design';

/**
 * Chave de um preset declarado — resolvida no `FieldRulePresetCatalog` em tempo de execução, e não
 * numa união fechada aqui. É o que permite a uma Extensão acrescentar CPF, RG ou placa sem tocar no
 * kernel. Os nomes seguem existindo porque descrevem o PAPEL da chave em cada slot.
 */
export type FormatPreset = string;

export type ValidateCheck = string;

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
  avg: '@core.records/aggregation.avg',
  min: 'Menor valor',
  max: 'Maior valor',
};

// ─── Campo de arquivo ─────────────────────────────────────────────────────────

/**
 * O que um campo `file` ACEITA. Fica aqui, e não no `FieldUiSpec`, porque extensão aceita e teto de
 * tamanho são restrição do dado — não a forma de desenhá-lo.
 */
export interface FieldFileConfig {
  /** Extensões aceitas, sem ponto e em minúsculas (`['png','jpg']`). Ausente/vazia = qualquer uma. */
  extensions?: string[];
  /** Tamanho máximo em MEGABYTES. Ausente = `DEFAULT_FILE_MAX_SIZE_MB`. */
  maxSizeMb?: number;
}

/**
 * O teto que a regra do Storage já cobra (`request.resource.size < 20 * 1024 * 1024`). Um default
 * maior seria promessa que o Storage quebra no momento do upload.
 */
export const DEFAULT_FILE_MAX_SIZE_MB = 20;

const IMAGE_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];

/**
 * A única leitura da config: o input, a validação de autoria e uma futura checagem no backend não
 * podem discordar sobre o que `['.PNG']` ou `maxSizeMb: 0` significam.
 */
export const resolveFileConfig = (
  config?: FieldFileConfig | null,
): { extensions: string[]; maxSizeMb: number } => {
  const extensions = (config?.extensions ?? [])
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
    .filter((extension) => extension.length > 0);
  const size = config?.maxSizeMb;
  return {
    extensions: [...new Set(extensions)],
    maxSizeMb:
      typeof size === 'number' && Number.isFinite(size) && size > 0 && size <= DEFAULT_FILE_MAX_SIZE_MB
        ? size
        : DEFAULT_FILE_MAX_SIZE_MB,
  };
};

/**
 * A prévia é DERIVADA do que o campo aceita, e não configurada à parte: um campo que só aceita
 * imagem mostra a imagem, e um que aceita qualquer arquivo mostra o nome.
 */
export const fileConfigIsImageOnly = (config?: FieldFileConfig | null): boolean => {
  const { extensions } = resolveFileConfig(config);
  return extensions.length > 0 && extensions.every((extension) => IMAGE_FILE_EXTENSIONS.includes(extension));
};

// ─── Tipos de controle de campo (compartilhados form/list/custom) ─────────────

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'select'
  | 'masked'
  | 'reference'
  | 'markdown'
  | 'file';

export type CustomFieldMask = string;

export interface CustomFieldOption {
  key: string;
  label: string;
  isStatic?: boolean;
  color?: string;
}

export interface RuleIssue {
  path: string;
  label: string;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string;
  errorParams?: Record<string, string>;
}

export {
  onlyDigits,
  isEmptyRuleValue,
  applyMaskTemplate,
  maskPlaceholder,
  isValidCpf,
  isValidCnpj,
} from './fieldRulePresets';

const runPresetExpression: FieldExpressionRunner = (expression, value) =>
  evaluateFieldExpression(expression, { value, data: {} });

export const applyFormat = (
  value: unknown,
  rule: FormatRule | undefined,
  catalog: FieldRulePresetCatalog = CORE_FIELD_RULE_PRESET_CATALOG,
): unknown => {
  if (!rule || typeof value !== 'string') return value;

  let next = value;
  if (rule.preset) next = applyFormatOps(next, catalog.get(rule.preset)?.format, runPresetExpression);

  if (rule.pattern) {
    const regex = buildRegExp(rule.pattern, rule.flags);
    if (regex) next = next.replace(regex, rule.replacement ?? '');
  }

  return next;
};

/**
 * Preset desconhecido ou expressão quebrada APROVAM o valor: uma extensão desinstalada não pode
 * transformar registros válidos em registros que ninguém consegue salvar. Mesma política do
 * `buildRegExp`, que devolve `null` em regex inválida em vez de estourar.
 */
const runPresetCheck = (
  preset: FieldRulePreset | undefined,
  value: string,
): string | undefined => {
  if (!preset?.validate) return undefined;

  const { expression, pattern, flags, message } = preset.validate;

  if (expression && !evaluateFieldBoolean(expression, { value, data: {} }, true)) {
    return message ?? '@core.records/field.invalid-value';
  }

  if (pattern) {
    const regex = buildRegExp(pattern, flags);
    if (regex && !regex.test(value)) return message ?? '@core.records/field.invalid-value';
  }

  return undefined;
};

export interface ValueIssue {
  error: string;
  errorParams?: Record<string, string>;
}

export const checkValue = (
  value: unknown,
  rule: ValidateRule | undefined,
  label: string,
  catalog: FieldRulePresetCatalog = CORE_FIELD_RULE_PRESET_CATALOG,
): ValueIssue | undefined => {
  if (!rule || isEmptyRuleValue(value)) return undefined;

  const text = typeof value === 'string' ? value : String(value);

  if (rule.check) {
    const presetError = runPresetCheck(catalog.get(rule.check), text);
    if (presetError) return { error: rule.message ?? presetError };
  }

  if (rule.pattern) {
    const regex = buildRegExp(rule.pattern, rule.flags);
    if (regex && !regex.test(text)) {
      return rule.message
        ? { error: rule.message }
        : { error: '@core.records/field.invalid-format', errorParams: { label } };
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
  catalog: FieldRulePresetCatalog = CORE_FIELD_RULE_PRESET_CATALOG,
): FormatAndValidateOutcome => {
  if (!rules) return { value };

  const formatted = applyFormat(value, rules.format, catalog);
  const issue = checkValue(formatted, rules.validate, label, catalog);

  return issue ? { value: formatted, issue: { path, label, ...issue } } : { value: formatted };
};

/** O resumo para LOG: guarda a chave, que identifica a regra que recusou o valor. */
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
