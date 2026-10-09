// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/validateReportSpec.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { isValidAccessPermissionId } from '../access/permission';
import { extractFieldExpressionPaths, fieldExpressionSyntaxError } from '../fieldExpression';
import { NUMERIC_AGGREGATION_OPS } from '../fieldRules';
import { parsePath, resolvePath } from '../pathResolver';
import type { PathRoot, SchemaContext } from '../pathResolver';
import { checkQueryPath, checkQueryPredicates, QUERY_OPERATORS, resolveQueryTable } from '../querySpec';
import {
  REPORT_CAPABILITIES,
  reportCapabilitySeverity,
  unsupportedReportCapabilities,
} from './reportCapabilities';
import {
  DEFAULT_REPORT_DATASET_KIND,
  isAggregateMeasure,
  REPORT_DATASET_KINDS,
  REPORT_SHAPE_KINDS,
  REPORT_SPEC_VERSION,
  reportGranularityOf,
} from './reportSpec';
import type { ReportGroupLevel, ReportSpec } from './reportSpec';

/**
 * Um problema do relatório.
 *
 * `error` é uma REFERÊNCIA de mensagem porque a validação roda também no backend, que não conhece
 * idioma. `severity` ausente é `error`; `warning` É a degradação de nível 2 — o relatório roda
 * mesmo assim, e o aviso é o que torna a perda visível.
 */
export interface ReportSpecIssue {
  field: string;
  error: string;
  errorParams?: Record<string, string>;
  severity?: 'error' | 'warning';
}

export interface ReportValidationContext {
  schema: SchemaContext;
  /** O que ESTE kernel entende. Ausente = `REPORT_CAPABILITIES`. */
  capabilities?: readonly string[];
  /** Teto de varredura permitido, para o aviso de grampeamento. */
  scanCeiling?: number;
}

export const hasBlockingReportIssue = (issues: ReportSpecIssue[]): boolean =>
  issues.some((issue) => (issue.severity ?? 'error') === 'error');

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const AGGREGATION_OPS: readonly string[] = NUMERIC_AGGREGATION_OPS;

const levelsOf = (spec: ReportSpec): ReportGroupLevel[] => {
  if (spec.shape.kind === 'summary') return spec.shape.groupBy;
  if (spec.shape.kind === 'matrix') return [...spec.shape.rows, ...spec.shape.columns];
  return spec.shape.groupBy ?? [];
};

const valuesOf = (spec: ReportSpec): string[] =>
  spec.shape.kind === 'tabular' ? [] : spec.shape.values;

/**
 * Tudo o que NÃO precisa do esquema do escritório.
 *
 * É o que `microteia pack` consegue cobrar, e a separação não é conveniência: no empacotamento não
 * EXISTE escritório — não há `SchemaContext`, e não pode haver. A tentação futura será embarcar um
 * retrato do esquema no pacote; a resposta é não, porque o esquema do escritório é do escritório.
 */
export const validateReportSpecShape = (
  spec: ReportSpec,
  capabilities: readonly string[] = REPORT_CAPABILITIES,
): ReportSpecIssue[] => {
  if (spec.v !== REPORT_SPEC_VERSION) {
    return [{
      field: 'v',
      error: '@core.reports/spec.version.unsupported',
      errorParams: { version: String(spec.v) },
    }];
  }

  const issues: ReportSpecIssue[] = [];

  for (const capability of unsupportedReportCapabilities(spec, capabilities)) {
    issues.push({
      field: 'requires',
      error: '@core.reports/spec.capability.unsupported',
      errorParams: { capability },
      severity: reportCapabilitySeverity(capability),
    });
  }

  const datasetKind = spec.dataset.kind ?? DEFAULT_REPORT_DATASET_KIND;
  if (!REPORT_DATASET_KINDS.includes(datasetKind)) {
    issues.push({
      field: 'dataset.kind',
      error: '@core.reports/dataset.kind.unsupported',
      errorParams: { kind: datasetKind },
    });
  }

  /*
   * A SINTAXE do filtro por expressão — a única checagem sobre ele que dispensa o esquema, e por isso
   * a única que o empacotamento consegue fazer.
   *
   * Recusa em vez de avisar porque uma expressão que não parseia não tem resultado: mantê-la como
   * aviso deixaria o relatório rodar com a expressão estourando linha a linha, o que sai como um
   * total menor sem uma palavra na tela.
   */
  const syntax = fieldExpressionSyntaxError(spec.dataset.includeWhen);
  if (syntax) {
    issues.push({
      field: 'dataset.includeWhen',
      error: '@core.reports/filter.syntax',
      errorParams: { detail: syntax },
    });
  }

  const dimensions = spec.dataset.dimensions ?? [];
  const measures = spec.dataset.measures ?? [];

  // Dimensões e medidas partilham UM espaço de nomes: `shape.values` precisa ser inequívoco no dia
  // em que uma dobra misturar os dois. Separar agora é barato; unir depois é impossível.
  const seen = new Set<string>();
  const declare = (key: string, field: string): void => {
    if (!KEY_PATTERN.test(key)) {
      issues.push({ field, error: '@core.reports/key.invalid', errorParams: { key } });
      return;
    }
    if (seen.has(key)) {
      issues.push({ field, error: '@core.reports/key.duplicated', errorParams: { key } });
      return;
    }
    seen.add(key);
  };

  dimensions.forEach((dimension, index) => declare(dimension.key, `dataset.dimensions[${index}].key`));
  measures.forEach((measure, index) => declare(measure.key, `dataset.measures[${index}].key`));

  dimensions.forEach((dimension, index) => {
    if (dimension.granularity !== undefined && !reportGranularityOf(dimension.granularity)) {
      issues.push({
        field: `dataset.dimensions[${index}].granularity`,
        error: '@core.reports/dimension.granularity.unsupported',
        errorParams: { key: dimension.key, granularity: String(dimension.granularity) },
        severity: 'warning',
      });
    }
  });

  measures.forEach((measure, index) => {
    if (!isAggregateMeasure(measure)) {
      issues.push({
        field: `dataset.measures[${index}].kind`,
        error: '@core.reports/measure.kind.unsupported',
        errorParams: { key: measure.key, kind: String(measure.kind) },
      });
      return;
    }
    if (!AGGREGATION_OPS.includes(measure.op)) {
      issues.push({
        field: `dataset.measures[${index}].op`,
        error: '@core.reports/measure.op.unsupported',
        errorParams: { key: measure.key, op: String(measure.op) },
      });
    }
    if (measure.op !== 'count' && !(measure.path ?? '').trim()) {
      issues.push({
        field: `dataset.measures[${index}].path`,
        error: '@core.reports/measure.path.missing',
        errorParams: { key: measure.key },
      });
    }
  });

  // Um relatório sem NÚMERO não tem o que dizer, e recusar isto aqui é o que dá motivo ao botão
  // desabilitado da autoria: sem a recusa, o gesto de salvar ficava inerte sem nada explicando por quê.
  if (measures.length === 0) {
    issues.push({ field: 'dataset.measures', error: '@core.reports/dataset.no-measure' });
  }

  if (!REPORT_SHAPE_KINDS.includes(spec.shape.kind)) {
    issues.push({
      field: 'shape.kind',
      error: '@core.reports/shape.kind.unsupported',
      errorParams: { kind: spec.shape.kind },
      severity: 'warning',
    });
    return issues;
  }

  const dimensionKeys = new Set(dimensions.map((dimension) => dimension.key));
  const measureKeys = new Set(measures.map((measure) => measure.key));

  levelsOf(spec).forEach((level, index) => {
    if (!dimensionKeys.has(level.dimension)) {
      issues.push({
        field: `shape.groupBy[${index}].dimension`,
        error: '@core.reports/shape.dimension.unknown',
        errorParams: { key: level.dimension },
      });
    }
  });

  /*
   * O campo DECLARADO que a dobra não mostra em lugar nenhum.
   *
   * É aviso, e não recusa: o número continua certo. Mas dizê-lo é o que faltava — quem escolhia dez
   * campos e trocava a dobra para resumo via nove deles sumirem sem uma palavra, e a leitura fácil
   * era achar que o relatório tinha perdido o dado.
   */
  const shownKeys = new Set<string>([
    ...levelsOf(spec).map((level) => level.dimension),
    ...(spec.shape.kind === 'tabular' ? spec.shape.columns : []),
  ]);
  const unused = dimensions.map((dimension) => dimension.key).filter((key) => !shownKeys.has(key));
  if (unused.length > 0) {
    issues.push({
      field: 'dataset.dimensions',
      error: '@core.reports/shape.fields-unused',
      errorParams: { keys: unused.join(', ') },
      severity: 'warning',
    });
  }

  valuesOf(spec).forEach((key, index) => {
    if (!measureKeys.has(key)) {
      issues.push({
        field: `shape.values[${index}]`,
        error: '@core.reports/shape.measure.unknown',
        errorParams: { key },
      });
    }
  });

  if (spec.shape.kind === 'tabular') {
    // Uma lista sem coluna nenhuma desenha uma tabela vazia — e "vazio" se confunde com "não há
    // dado", que é a leitura errada. Quando o que a esvaziou foi o AGRUPAMENTO, a recusa diz isso:
    // "acrescente uma coluna" não tem o que ensinar a quem já declarou o único campo que tinha.
    if (spec.shape.columns.length === 0) {
      issues.push({
        field: 'shape.columns',
        error: (spec.shape.groupBy ?? []).length > 0
          ? '@core.reports/shape.tabular.only-grouped'
          : '@core.reports/shape.tabular.no-columns',
      });
    }
    spec.shape.columns.forEach((key, index) => {
      if (measureKeys.has(key)) {
        issues.push({
          field: `shape.columns[${index}]`,
          error: '@core.reports/shape.tabular.measure',
          errorParams: { key },
        });
      } else if (!dimensionKeys.has(key)) {
        issues.push({
          field: `shape.columns[${index}]`,
          error: '@core.reports/shape.dimension.unknown',
          errorParams: { key },
        });
      }
    });
  }

  // Um resumo é feito de grupos. Sem nível nenhum, `buildTree` não tem o que percorrer e o
  // relatório saía "Nenhum dado" sobre uma coleção cheia — o sintoma que mais parece defeito do dado.
  if (spec.shape.kind === 'summary' && spec.shape.groupBy.length === 0) {
    issues.push({ field: 'shape.groupBy', error: '@core.reports/shape.summary.no-group' });
  }

  if (spec.shape.kind === 'matrix') {
    if (spec.shape.rows.length === 0 || spec.shape.columns.length === 0) {
      issues.push({ field: 'shape', error: '@core.reports/shape.matrix.incomplete' });
    }
    if (spec.shape.columns.length > 1) {
      issues.push({
        field: 'shape.columns',
        error: '@core.reports/shape.matrix.levels-flattened',
        severity: 'warning',
      });
    }
  }

  const chart = spec.presentation?.chart;
  if (chart) {
    // Sem grupo não há ponto a desenhar: o gráfico saía uma moldura vazia ao lado de uma tabela
    // cheia, e quem o configurou não tinha como saber por quê. A lista AGRUPADA tem grupos, e por
    // isso desenha — o aviso aqui só vale para a lista corrida.
    if (spec.shape.kind === 'tabular' && (spec.shape.groupBy ?? []).length === 0) {
      issues.push({
        field: 'presentation.chart',
        error: '@core.reports/chart.shape.tabular',
        severity: 'warning',
      });
    }

    const citedKeys = [
      ...(chart.category ? [chart.category] : []),
      ...(chart.splitBy ? [chart.splitBy] : []),
      ...(chart.series ?? []),
    ];
    for (const key of citedKeys) {
      if (!dimensionKeys.has(key) && !measureKeys.has(key)) {
        issues.push({
          field: 'presentation.chart',
          error: '@core.reports/chart.key.unknown',
          errorParams: { key },
          severity: 'warning',
        });
      }
    }
  }

  const promptKeys = new Set<string>();
  (spec.presentation?.prompts ?? []).forEach((prompt, index) => {
    if (promptKeys.has(prompt.key)) {
      issues.push({
        field: `presentation.prompts[${index}].key`,
        error: '@core.reports/prompt.key.duplicated',
        errorParams: { key: prompt.key },
      });
    }
    promptKeys.add(prompt.key);

    if (!QUERY_OPERATORS.includes(prompt.op)) {
      issues.push({
        field: `presentation.prompts[${index}].op`,
        error: '@core.reports/prompt.op.unsupported',
        errorParams: { op: String(prompt.op) },
      });
    }
  });

  const permission = spec.access?.permission;
  if (permission !== undefined && !isValidAccessPermissionId(permission)) {
    issues.push({
      field: 'access.permission',
      error: '@core.reports/access.permission.invalid',
      errorParams: { id: permission },
    });
  }

  if (spec.schedule) {
    issues.push({
      field: 'schedule',
      error: '@core.reports/schedule.not-implemented',
      severity: 'warning',
    });
  }

  return issues;
};

/**
 * Forma + esquema. Roda no front antes de salvar e no back antes de executar — a MESMA função, para
 * que não exista um caminho em que o relatório é aceito e outro em que é recusado.
 */
export const validateReportSpec = (
  spec: ReportSpec,
  ctx: ReportValidationContext,
): ReportSpecIssue[] => {
  const issues = validateReportSpecShape(spec, ctx.capabilities);
  if (spec.v !== REPORT_SPEC_VERSION) return issues;

  const resolved = resolveQueryTable(spec.dataset.table, ctx.schema);
  if (!resolved) {
    issues.push({
      field: 'dataset.table',
      error: '@core.reports/dataset.table.unknown',
      errorParams: { table: spec.dataset.table },
    });
    return issues;
  }

  const root: PathRoot = resolved.root;
  const check = (path: string, field: string): void => {
    issues.push(...checkQueryPath(ctx.schema, root, path, field));
  };

  issues.push(...checkQueryPredicates(ctx.schema, root, spec.dataset.where ?? [], 'dataset.where'));

  // Os caminhos que a EXPRESSÃO lê passam pela mesma porta dos outros: é a lista que a hidratação
  // traz e que o RBAC cobra, então um caminho que o esquema não sabe atravessar tem de aparecer aqui
  // e não na hora de avaliar.
  for (const path of extractFieldExpressionPaths(spec.dataset.includeWhen)) {
    check(path, 'dataset.includeWhen');
  }

  (spec.dataset.dimensions ?? []).forEach((dimension, index) => {
    check(dimension.path, `dataset.dimensions[${index}].path`);

    // Balde sobre o que não é data é ignorado no cálculo. É AVISO, e não erro: o relatório continua
    // correto — ele só agrupa pelo valor cru —, e a perda se vê na tela.
    if (!reportGranularityOf(dimension.granularity)) return;
    const resolution = resolvePath(ctx.schema, root, parsePath(dimension.path));
    if (resolution.valid && resolution.node.kind === 'scalar' && resolution.node.type !== 'date') {
      issues.push({
        field: `dataset.dimensions[${index}].granularity`,
        error: '@core.reports/dimension.granularity.not-date',
        errorParams: { key: dimension.key },
        severity: 'warning',
      });
    }
  });

  (spec.dataset.measures ?? []).forEach((measure, index) => {
    if (!isAggregateMeasure(measure)) return;

    issues.push(...checkQueryPredicates(
      ctx.schema,
      root,
      measure.filter ?? [],
      `dataset.measures[${index}].filter`,
    ));

    const path = (measure.path ?? '').trim();
    if (!path) return;
    check(path, `dataset.measures[${index}].path`);

    // `sum`/`avg` sobre texto é AVISO, não recusa: `applyAggregationOp` já coage e devolve 0 — uma
    // soma que parece um número e não é, o pior sintoma possível, e por isso precisa gritar. Mas
    // recusar mataria o caso legítimo do campo numérico gravado como texto por uma importação.
    if (measure.op !== 'sum' && measure.op !== 'avg') return;
    const resolution = resolvePath(ctx.schema, root, parsePath(path));
    if (resolution.valid && resolution.node.kind === 'scalar' && resolution.node.type !== 'number') {
      issues.push({
        field: `dataset.measures[${index}].path`,
        error: '@core.reports/measure.path.not-numeric',
        errorParams: { key: measure.key },
        severity: 'warning',
      });
    }
  });

  if (spec.shape.kind === 'tabular') {
    (spec.shape.orderBy ?? []).forEach((order, index) =>
      check(order.path, `shape.orderBy[${index}].path`));
  }

  (spec.presentation?.prompts ?? []).forEach((prompt, index) =>
    check(prompt.path, `presentation.prompts[${index}].path`));

  // Pedido acima do teto GRAMPEIA e avisa, nunca recusa: quem pede dez mil linhas deve receber o
  // teto com o aviso de que é parcial, e não um relatório que não abre.
  const asked = spec.dataset.scanLimit;
  const ceiling = ctx.scanCeiling;
  if (asked !== undefined && ceiling !== undefined && asked > ceiling) {
    issues.push({
      field: 'dataset.scanLimit',
      error: '@core.reports/limit.clamped',
      errorParams: { asked: String(asked), allowed: String(ceiling) },
      severity: 'warning',
    });
  }

  return issues;
};
