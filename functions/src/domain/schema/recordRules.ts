// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordRules.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NativeFieldSpec } from './entityRegistry';
import {
  evaluateFieldExpression,
  evaluateFieldValidation,
  extractFieldExpressionDependencies,
} from './fieldExpression';
import type { FieldLogic, FieldRules, RuleIssue } from './fieldRules';
import { formatAndValidate } from './fieldRules';
import { coerceWriteValue, flattenDataLeaves, resolveWritableTable, setValueAtPath } from './mutationSpec';
import type { SchemaContext } from './pathResolver';
import { resolveEntity } from './screenEntity';

export interface ResolvedFieldRules {
  rules: FieldRules;
  label: string;
}

const findNativeField = (
  fields: NativeFieldSpec[],
  parts: string[],
): NativeFieldSpec | undefined => {
  const [head, ...rest] = parts;
  const field = fields.find((candidate) => candidate.key === head);
  if (!field) return undefined;

  if (rest.length > 0) {
    return field.objectFields ? findNativeField(field.objectFields, rest) : undefined;
  }

  return field;
};

/**
 * O campo declarado no caminho pedido, de qualquer origem — é ele que diz o TIPO em que o valor
 * deve ser gravado e as regras de formato/validação que valem para ele.
 */
export const resolveFieldSpec = (
  ctx: SchemaContext,
  table: string,
  path: string,
): NativeFieldSpec | undefined => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return undefined;

  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return undefined;

  const entity = resolveEntity(ctx, outcome.value.physicalCollection);
  if (!entity) return undefined;

  return findNativeField(entity.fields, parts);
};

export const resolveFieldRules = (
  ctx: SchemaContext,
  table: string,
  path: string,
): ResolvedFieldRules | undefined => {
  const field = resolveFieldSpec(ctx, table, path);
  return field?.rules ? { rules: field.rules, label: field.label } : undefined;
};

export type FieldLogicSlot = 'validate' | 'compute' | 'derive';

export interface FieldLogicTarget {
  key: string;
  path: string;
  label: string;
  expr: string;
  dependencies: string[];
}

/**
 * Escopo das expressões de campo: o próprio registro. Como todo campo — fixo, de extensão ou do
 * Form Design — mora na raiz do documento, a mesma expressão funciona no front e no back
 * referenciando os campos por `key`, sem nenhum desempacotamento.
 *
 * A assinatura mantém `ctx` e `table` porque é ponto de extensão do escopo (hidratação de FK no
 * front, por exemplo) e para não obrigar os chamadores a mudar quando isso voltar a variar.
 */
export const buildRecordFieldScope = (
  _ctx: SchemaContext,
  _table: string,
  data: Record<string, unknown>,
): Record<string, unknown> => ({ ...data });

const readLogicSlot = (
  logic: FieldLogic | null | undefined,
  slot: FieldLogicSlot,
): string | undefined => {
  const expr =
    slot === 'validate' ? logic?.validate : slot === 'compute' ? logic?.compute : logic?.derive;
  return expr && expr.trim() ? expr : undefined;
};

/**
 * Campos da entidade com expressão no slot pedido. `path` é igual a `key` porque todo campo mora na
 * raiz do documento; campos aninhados em `objectFields` ficam de fora, como sempre estiveram — o
 * escopo é plano por chave de topo.
 */
export const collectFieldLogicTargets = (
  ctx: SchemaContext,
  table: string,
  slot: FieldLogicSlot,
): FieldLogicTarget[] => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return [];

  const entity = resolveEntity(ctx, outcome.value.physicalCollection);
  const targets: FieldLogicTarget[] = [];

  for (const field of entity?.fields ?? []) {
    const expr = readLogicSlot(field.logic, slot);
    if (!expr) continue;
    targets.push({
      key: field.key,
      path: field.key,
      label: field.label,
      expr,
      dependencies: extractFieldExpressionDependencies(expr),
    });
  }

  return targets;
};

const evaluateExpressionValidations = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
): RuleIssue[] => {
  const targets = collectFieldLogicTargets(ctx, table, 'validate');
  if (targets.length === 0) return [];

  const scope = buildRecordFieldScope(ctx, table, data);
  const issues: RuleIssue[] = [];
  for (const target of targets) {
    const error = evaluateFieldValidation(target.expr, { value: scope[target.key], data: scope });
    if (error) issues.push({ path: target.path, label: target.label, error });
  }
  return issues;
};

/**
 * Ordena os campos computados de forma que um computado que depende de outro seja avaliado depois
 * dele. Campos envolvidos em ciclo são descartados — a expressão não é avaliada e o valor anterior
 * do campo permanece intacto.
 */
export const orderComputeTargets = (targets: FieldLogicTarget[]): FieldLogicTarget[] => {
  const byKey = new Map(targets.map((target) => [target.key, target]));
  const ordered: FieldLogicTarget[] = [];
  const settled = new Set<string>();
  const visiting = new Set<string>();

  const visit = (target: FieldLogicTarget): boolean => {
    if (settled.has(target.key)) return true;
    if (visiting.has(target.key)) return false;

    visiting.add(target.key);
    for (const dependency of target.dependencies) {
      const upstream = byKey.get(dependency);
      if (upstream && upstream.key !== target.key && !visit(upstream)) {
        visiting.delete(target.key);
        return false;
      }
    }
    visiting.delete(target.key);

    settled.add(target.key);
    ordered.push(target);
    return true;
  };

  for (const target of targets) visit(target);
  return ordered;
};

/**
 * Avalia os alvos na ordem de dependência sobre um escopo plano por chave de campo. Cada resultado
 * entra no escopo antes do próximo alvo, para que um computado enxergue outro. Expressão que lança
 * é ignorada — campo computado nunca bloqueia a gravação.
 */
const evaluateComputeTargets = (
  targets: FieldLogicTarget[],
  scope: Record<string, unknown>,
  at?: Date,
): Map<string, unknown> => {
  const resolved = new Map<string, unknown>();
  const working = { ...scope };

  for (const target of orderComputeTargets(targets)) {
    try {
      const value = evaluateFieldExpression(target.expr, {
        value: working[target.key],
        data: working,
        at,
      });
      if (value === undefined) continue;
      working[target.key] = value;
      resolved.set(target.key, value);
    } catch {
      continue;
    }
  }

  return resolved;
};

/**
 * Versão plana, para o formulário: recebe os campos de uma tela e os valores por chave, devolvendo
 * só os computados. É a MESMA avaliação do save, para o que o usuário vê enquanto digita não
 * divergir do que será persistido.
 */
export const computeFieldValues = (
  fields: { key: string; label?: string; logic?: FieldLogic | null }[],
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const targets: FieldLogicTarget[] = [];
  for (const field of fields) {
    const expr = readLogicSlot(field.logic, 'compute');
    if (!expr) continue;
    targets.push({
      key: field.key,
      path: field.key,
      label: field.label ?? field.key,
      expr,
      dependencies: extractFieldExpressionDependencies(expr),
    });
  }
  if (targets.length === 0) return {};

  return Object.fromEntries(evaluateComputeTargets(targets, values));
};

/**
 * Avalia as expressões `logic.compute` e grava o resultado no próprio registro. O escopo parte do
 * `baseline` (registro já existente) sobreposto pelos valores recebidos, para que um payload parcial
 * — típico do Step "Gravar Registro" — não recompute com dependências ausentes.
 */
export const applyComputedFields = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
  baseline?: Record<string, unknown>,
): Record<string, unknown> => {
  const targets = collectFieldLogicTargets(ctx, table, 'compute');
  if (targets.length === 0) return data;

  const scope: Record<string, unknown> = {
    ...(baseline ? buildRecordFieldScope(ctx, table, baseline) : {}),
    ...buildRecordFieldScope(ctx, table, data),
  };

  const resolved = evaluateComputeTargets(targets, scope);
  const next = { ...data };
  for (const target of targets) {
    if (resolved.has(target.key)) setValueAtPath(next, target.path, resolved.get(target.key));
  }

  return next;
};

/**
 * As chaves dos campos DERIVADOS da tabela. Elas nunca são gravadas: o portão de escrita as
 * descarta do payload, venha ele do formulário, de uma automação, de um Script ou de uma callable.
 */
export const collectDerivedFieldKeys = (
  ctx: SchemaContext,
  table: string,
): ReadonlySet<string> =>
  new Set(collectFieldLogicTargets(ctx, table, 'derive').map((target) => target.key));

/**
 * Avalia as expressões `logic.derive` sobre um registro JÁ LIDO e devolve a cópia com os valores no
 * lugar. É a contrapartida de leitura do `applyComputedFields` — e o motivo de ela existir é que uma
 * expressão que consulta o relógio não sobrevive à gravação: o valor certo é o do momento em que se
 * olha, não o do momento em que se salvou.
 *
 * `at` é o instante que `today()`/`now()` respondem. Quem lê uma lista o captura UMA vez e o passa a
 * todos os registros, para que a lista inteira fale do mesmo momento. Ausente, vale o relógio.
 *
 * Expressão que estoura deixa a chave ausente — campo derivado nunca impede uma leitura.
 */
export const applyDerivedFields = (
  ctx: SchemaContext,
  table: string,
  record: Record<string, unknown>,
  at?: Date,
): Record<string, unknown> => {
  const targets = collectFieldLogicTargets(ctx, table, 'derive');
  if (targets.length === 0) return record;

  const resolved = evaluateComputeTargets(targets, buildRecordFieldScope(ctx, table, record), at);
  if (resolved.size === 0) return record;

  const next = { ...record };
  for (const target of targets) {
    if (resolved.has(target.key)) setValueAtPath(next, target.path, resolved.get(target.key));
  }

  return next;
};

/**
 * Versão plana, para o formulário: recebe os campos de uma tela e os valores por chave, devolvendo
 * só os derivados. Mesma relação que `computeFieldValues` tem com `applyComputedFields`.
 */
export const deriveFieldValues = (
  fields: { key: string; label?: string; logic?: FieldLogic | null }[],
  values: Record<string, unknown>,
  at?: Date,
): Record<string, unknown> => {
  const targets: FieldLogicTarget[] = [];
  for (const field of fields) {
    const expr = readLogicSlot(field.logic, 'derive');
    if (!expr) continue;
    targets.push({
      key: field.key,
      path: field.key,
      label: field.label ?? field.key,
      expr,
      dependencies: extractFieldExpressionDependencies(expr),
    });
  }
  if (targets.length === 0) return {};

  return Object.fromEntries(evaluateComputeTargets(targets, values, at));
};

export interface RecordRulesOutcome {
  data: Record<string, unknown>;
  issues: RuleIssue[];
}

/**
 * Portão único de escrita, do formulário e do motor de workflows. Para cada folha PRESENTE em
 * `data`, converte o valor para o TIPO declarado no campo e aplica `format`/`validate` quando há
 * regra. É aqui que uma data digitada no formulário vira `Date` — e por isso um campo `date` é
 * gravado como Timestamp em qualquer tela, fixa, de extensão ou do Form Design, deixando o evento
 * `<coleção>.saved` entregar uma data de verdade às expressões.
 *
 * Folhas de campos não declarados passam intactas; valores vazios nunca reprovam (obrigatoriedade
 * é `required`).
 */
export interface RecordRulesOptions {
  // Caminhos cuja regra de schema deve ser ignorada — usado pelo Step "Validar Objeto", onde as
  // regras declaradas nos parâmetros SOBREPÕEM as da entidade.
  skipPaths?: ReadonlySet<string>;
  // Registro já existente, usado como base do escopo dos campos computados quando `data` é parcial.
  baseline?: Record<string, unknown>;
  // Desliga a avaliação de `logic.compute` — usado pelo Step "Validar Objeto", que checa um objeto
  // avulso e não um registro que será gravado.
  skipCompute?: boolean;
}

export const formatAndValidateRecord = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
  options: RecordRulesOptions = {},
): RecordRulesOutcome => {
  const next: Record<string, unknown> = {};
  const issues: RuleIssue[] = [];
  // Campo derivado não se grava. A folha é descartada aqui — antes da coerção, do formato e da
  // validação —, e é por isso que `compute` e `validate` não o enxergam no escopo: os dois rodam na
  // gravação, e um valor de leitura ali seria o do instante do save, congelado no documento.
  const derived = collectDerivedFieldKeys(ctx, table);

  for (const leaf of flattenDataLeaves(data)) {
    if (derived.has(leaf.path.split('.')[0])) continue;
    const skipped = options.skipPaths?.has(leaf.path.split('.')[0]);
    const field = skipped ? undefined : resolveFieldSpec(ctx, table, leaf.path);
    const value = field ? coerceWriteValue(field.type, leaf.value) : leaf.value;

    if (!field?.rules) {
      setValueAtPath(next, leaf.path, value);
      continue;
    }

    const outcome = formatAndValidate(
      value,
      field.rules,
      leaf.path,
      field.label,
      ctx.fieldRulePresets,
    );
    setValueAtPath(next, leaf.path, outcome.value);
    if (outcome.issue) issues.push(outcome.issue);
  }

  const computed = options.skipCompute
    ? next
    : applyComputedFields(ctx, table, next, options.baseline);

  issues.push(...evaluateExpressionValidations(ctx, table, computed));

  return { data: computed, issues };
};
