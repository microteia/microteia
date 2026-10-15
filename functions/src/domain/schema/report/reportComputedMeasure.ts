// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportComputedMeasure.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportComputedMeasure.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { evaluateFieldExpression, extractFieldExpressionDependencies } from '../fieldExpression';
import type { ReportComputedMeasure, ReportMeasure } from './reportSpec';

export const isComputedMeasure = (measure: ReportMeasure): measure is ReportComputedMeasure =>
  measure.kind === 'computed';

/** As chaves de medida que a expressão cita. O escopo dela são as OUTRAS medidas — nunca o registro. */
export const computedMeasureReferences = (measure: ReportComputedMeasure): string[] =>
  [...new Set(extractFieldExpressionDependencies(measure.expression))];

/**
 * As medidas calculadas que dependem de si mesmas, direta ou indiretamente.
 *
 * Um ciclo não tem valor a dar: avaliá-lo devolveria `null` em toda célula, e um relatório de
 * travessões parece dado ausente, não erro de autoria. Por isso é recusa na validação.
 */
export const computedMeasureCycles = (measures: ReportMeasure[]): string[] => {
  const computed = new Map(
    measures.filter(isComputedMeasure).map((measure) => [measure.key, measure] as const),
  );
  const done = new Set<string>();
  const cyclic = new Set<string>();
  const stack: string[] = [];

  const visit = (key: string): void => {
    if (done.has(key)) return;
    const open = stack.indexOf(key);
    if (open >= 0) {
      for (const member of stack.slice(open)) cyclic.add(member);
      return;
    }
    const measure = computed.get(key);
    if (!measure) return;

    stack.push(key);
    for (const reference of computedMeasureReferences(measure)) visit(reference);
    stack.pop();
    done.add(key);
  };

  for (const key of computed.keys()) visit(key);
  return [...computed.keys()].filter((key) => cyclic.has(key));
};

/**
 * O valor da medida calculada, sobre os valores JÁ AGREGADOS do mesmo grupo.
 *
 * É avaliada depois da agregação em cada linha, subtotal, célula e total — e é isso que faz uma razão
 * de somas ser a razão do grupo, e não a média das razões das linhas.
 *
 * Medida citada sem valor dá `null`: média de nada não é zero, e uma razão sobre um número que ninguém
 * afirmou também não é. O mesmo vale para o que não é número finito — divisão por zero inclusive —,
 * porque `Infinity` numa célula é uma afirmação que nenhum dado sustenta.
 */
export const evaluateComputedMeasure = (
  measure: ReportComputedMeasure,
  values: Record<string, number | null>,
): number | null => {
  const scope: Record<string, number> = {};
  for (const reference of computedMeasureReferences(measure)) {
    const value = values[reference];
    if (value === null || value === undefined) return null;
    scope[reference] = value;
  }

  try {
    const result = evaluateFieldExpression(measure.expression, { value: null, data: scope });
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};
