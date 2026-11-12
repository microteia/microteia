// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportExactTotals.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportExactTotals.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { parsePath, resolvePath } from '../pathResolver';
import type { SchemaContext } from '../pathResolver';
import { resolveQueryTable } from '../querySpec';
import { collectDerivedFieldKeys } from '../recordRules';
import { isAggregateMeasure } from './reportSpec';
import { computedMeasureReferences, evaluateComputedMeasure, isComputedMeasure } from './reportComputedMeasure';
import type { ReportSpec } from './reportSpec';
import type { ReportResult } from './reportResult';

/** Uma medida que o BANCO responde sozinho: contagem, soma ou média de um campo do documento. */
export interface ReportTotalsPlanItem {
  key: string;
  op: 'count' | 'sum' | 'avg';
  /** O campo somado ou mediado, no documento; ausente na contagem. */
  path?: string;
}

/** O que o banco respondeu: os registros que atendem e o valor de cada medida do plano. */
export interface ReportExactTotals {
  count: number;
  values: Record<string, number | null>;
}

/**
 * O total que o Firestore pode responder sobre TODOS os registros — ou `null` quando não pode responder
 * com o MESMO número que a agregação em memória daria.
 *
 * Cada condição fecha uma diferença real entre os dois:
 * - o filtro por expressão e o cruzamento com relacionados só existem em memória;
 * - o teto pedido pelo autor (`scanLimit`) é uma decisão dele, e o total "de tudo" a desfaria;
 * - o banco não sabe mínimo, máximo, contagem distinta nem medida filtrada;
 * - a soma e a média valem sobre um campo NUMÉRICO do próprio documento: um caminho que entra noutra
 *   coleção precisa de hidratação, e um campo derivado não existe no documento;
 * - a medida calculada vem das outras, e por isso não impede: ela é refeita sobre os totais exatos.
 *
 * Quem decide se os FILTROS descem inteiros é a consulta (`runWorkflowQuery`), que é quem sabe o que ela
 * mandou ao banco; aqui é só o relatório.
 */
export const exactTotalsPlan = (spec: ReportSpec, ctx: SchemaContext): ReportTotalsPlanItem[] | null => {
  if ((spec.dataset.includeWhen ?? '').trim() !== '') return null;
  if ((spec.dataset.related ?? []).length > 0) return null;
  if (spec.dataset.scanLimit !== undefined) return null;
  const table = resolveQueryTable(spec.dataset.table, ctx);
  if (!table) return null;
  const derived = collectDerivedFieldKeys(ctx, spec.dataset.table);

  const plan: ReportTotalsPlanItem[] = [];
  for (const measure of spec.dataset.measures ?? []) {
    if (isComputedMeasure(measure)) continue;
    if (!isAggregateMeasure(measure)) return null;
    if ((measure.filter ?? []).length > 0) return null;
    if (measure.op === 'count') {
      if (measure.distinct === true) return null;
      plan.push({ key: measure.key, op: 'count' });
      continue;
    }
    if (measure.op !== 'sum' && measure.op !== 'avg') return null;
    const path = measure.path ?? '';
    const resolution = resolvePath(ctx, table.root, parsePath(path));
    const numericOnDocument = resolution.valid
      && resolution.hops.length === 0
      && resolution.node.kind === 'scalar'
      && resolution.node.type === 'number'
      && resolution.node.list !== true
      && !derived.has(path.split('.')[0]);
    if (!numericOnDocument) return null;
    plan.push({ key: measure.key, op: measure.op, path });
  }
  return plan.length > 0 ? plan : null;
};

/**
 * O resultado com os totais EXATOS no lugar dos da varredura parcial. Os grupos continuam os da
 * varredura — e continuam parciais (`complete: false`) —, mas o total passa a ser de todos os registros,
 * e `totalsExact` o diz. A medida calculada é refeita sobre os totais novos: a taxa sobre o total exato
 * não pode ficar com o numerador parcial.
 *
 * Sem total na dobra (`grandTotal: false`), nada muda: o autor pediu que não houvesse total.
 */
export const withExactTotals = (result: ReportResult, spec: ReportSpec, exact: ReportExactTotals): ReportResult => {
  if (!result.totals) return result;
  const measures = new Map((spec.dataset.measures ?? []).map((measure) => [measure.key, measure] as const));
  const resolved = new Map<string, number | null>(Object.entries(exact.values));
  const valueOf = (key: string, seen: Set<string>): number | null => {
    if (resolved.has(key)) return resolved.get(key) ?? null;
    const measure = measures.get(key);
    if (!measure || !isComputedMeasure(measure) || seen.has(key)) return null;
    seen.add(key);
    const value = evaluateComputedMeasure(measure, Object.fromEntries(
      computedMeasureReferences(measure).map((reference) => [reference, valueOf(reference, seen)]),
    ));
    resolved.set(key, value);
    return value;
  };
  return {
    ...result,
    totals: {
      count: exact.count,
      values: Object.fromEntries(Object.keys(result.totals.values).map((key) => [key, valueOf(key, new Set())])),
    },
    totalsExact: true,
  };
};
