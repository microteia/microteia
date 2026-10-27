// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  FieldExpressionRunner,
  FieldRulePreset,
  FieldRulePresetCatalog,
} from './fieldRulePresets';
import type { QueryOrderBy } from './querySpec';
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
  minLength?: number;
  maxLength?: number;
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
  /**
   * Chave devolvida pelo provedor → campo da tela que a recebe: `{ street: 'enderecoLogradouro' }`.
   *
   * Existe porque o prefixo só sabe montar `<prefixo>.<chave>`, e um objeto de valor ACHATADO
   * (`enderecoLogradouro`, `enderecoBairro`) não tem ponto nenhum — nem o nome da chave do provedor.
   * Declarado, ele manda sozinho: a chave que não aparece aqui é descartada, e `targetPrefix` não se
   * aplica. Ausente, vale o prefixo, como sempre valeu.
   */
  map?: Record<string, string> | null;
}

export interface FieldLogic {
  validate?: string | null;
  disabledWhen?: string | null;
  hiddenWhen?: string | null;
  compute?: string | null;
  /**
   * O valor do campo AVALIADO NA LEITURA, e jamais gravado — a contrapartida de `compute`, que
   * deriva na gravação e persiste.
   *
   * A diferença é o que a expressão pode olhar. `compute` é a resposta certa quando o valor só
   * depende do registro: ele fica no documento, filtrável e ordenável no servidor, e não envelhece
   * porque nada fora do registro mudou. Uma expressão que consulta o RELÓGIO (`today()`, `now()`)
   * não tem essa propriedade: o veredito é do dia em que foi salvo. Uma dose gravada hoje como "em
   * dia" continuaria "em dia" um ano depois — e o campo passa a mentir sem sintoma nenhum, porque
   * nada no sistema volta para desmenti-lo.
   *
   * `derive` responde no momento em que se olha. Em troca, o valor não existe no documento: ele não
   * entra em índice, não é empurrado como filtro de igualdade para o Firestore e não pode ser
   * agregado num campo do pai (o agregado é gravado, e voltaria a envelhecer). Filtro e ordenação
   * continuam funcionando — em memória, sobre a janela já carregada, como qualquer caminho de FK.
   *
   * Um campo derivado é somente-leitura no formulário e é REMOVIDO do payload em todos os caminhos
   * de escrita: não há como gravá-lo por engano nem referenciá-lo em `compute`/`validate`, que
   * rodam na gravação e não o enxergam.
   */
  derive?: string | null;
  // Front-only: expressão que DEVOLVE um objeto, mesclado no formulário quando o campo muda.
  // Semeia valores que o usuário ainda pode editar — ao contrário de `compute`, que deriva sempre.
  onChange?: string | null;
  onChangeLookup?: FieldLookupBinding | null;
}

// ─── Agregação sobre registros filhos ─────────────────────────────────────────

/**
 * As operações que devolvem NÚMERO. São as únicas que um relatório mede: `latest` copia um valor,
 * e uma medida de relatório que não fosse número não teria como ser somada, comparada ou desenhada.
 */
export type NumericAggregationOp = 'sum' | 'count' | 'avg' | 'min' | 'max';

/**
 * `latest` é a primeira operação que não calcula: ela ESCOLHE um filho — o primeiro que passa no
 * `filter`, depois de ordenado por `orderBy` — e copia o `field` dele como está. "Primeiro" é a
 * mesma operação com `dir: 'asc'`.
 */
export type AggregationOp = NumericAggregationOp | 'latest';

export const NUMERIC_AGGREGATION_OPS: readonly NumericAggregationOp[] = ['sum', 'count', 'avg', 'min', 'max'];

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
  // Campo do filho medido (ou copiado, em `latest`); ignorado por `count`.
  field?: string | null;
  // Expressão booleana avaliada sobre o filho — só entra no agregado quando verdadeira.
  filter?: string | null;
  // Só `latest`, e obrigatório nela: qual filho é o "mais recente". Ordenado em memória.
  orderBy?: QueryOrderBy[] | null;
}

export const AGGREGATION_OP_LABELS: Record<AggregationOp, string> = {
  sum: '@core.records/aggregation.sum',
  count: '@core.records/aggregation.count',
  avg: '@core.records/aggregation.avg',
  min: '@core.records/aggregation.min',
  max: '@core.records/aggregation.max',
  latest: '@core.records/aggregation.latest',
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

/**
 * Os tipos de campo, como ARRAY e não como união escrita à mão — a união sai dele.
 *
 * A ordem é a que o `AUTHORING.md` publica, e é por isso que o array existe: a tabela de tipos de
 * campo do guia de autoria é DERIVADA daqui, e um tipo novo aparece nela sem ninguém se lembrar.
 * Enquanto isto era só uma união, nada ligava o vocabulário do kernel ao texto entregue a quem
 * escreve extensão — e quem escreve extensão não tem o código-fonte para conferir.
 */
export const CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'time',
  'checkbox',
  'select',
  'masked',
  'reference',
  'markdown',
  'file',
] as const;

export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number];

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

  if (rule.minLength !== undefined && text.length < rule.minLength) {
    return rule.message
      ? { error: rule.message }
      : { error: '@core.records/field.too-short', errorParams: { label, min: String(rule.minLength) } };
  }

  if (rule.maxLength !== undefined && text.length > rule.maxLength) {
    return rule.message
      ? { error: rule.message }
      : { error: '@core.records/field.too-long', errorParams: { label, max: String(rule.maxLength) } };
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

/** O resumo para LOG TÉCNICO: guarda a chave, que identifica a regra que recusou o valor. */
export const describeRuleIssues = (issues: RuleIssue[]): string =>
  issues.map((issue) => `${issue.label}: ${issue.error}`).join('; ');

/** O bastante para descrever uma recusa: de que campo é, e qual referência diz o motivo. */
export interface DescribableIssue {
  label: string;
  error: string;
  errorParams?: Record<string, string>;
}

/**
 * Os parâmetros da mensagem que EMBRULHA uma recusa de regra.
 *
 * `describeRuleIssues` serve ao log técnico e não serve à tela: ele junta as recusas numa string, e
 * a referência de cada uma (`@core.records/field.invalid-format`) fica enterrada no meio dela, onde
 * nada mais a resolve — quem lia a execução via a referência crua, ou o `{detail}` intacto quando o
 * chamador nem repassava os valores. Aqui a recusa volta a ser referência mais valores, que é a
 * única forma que o backend tem de falar: `detail` aponta para o embrulho e os irmãos descem para a
 * frase de dentro, exatamente como `resolveParam` do catálogo resolve.
 *
 * Descreve o PRIMEIRO issue, e conta os demais: um conjunto de irmãos interpola uma frase, não
 * duas, e a recusa que interessa a quem corrige é a primeira. `others` é o que impede a segunda de
 * sumir sem aviso.
 */
export const ruleIssueParams = (issues: readonly DescribableIssue[]): Record<string, string> => {
  const first = issues[0];
  if (!first) return {};
  const others = issues.length - 1;
  return {
    ...first.errorParams,
    detail: others > 0 ? '@core.records/field.issue-more' : '@core.records/field.issue',
    label: first.label,
    reason: first.error,
    others: String(others),
  };
};

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
