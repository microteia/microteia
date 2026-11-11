// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportHighlight.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReportHighlight, ReportHighlightTone, ReportSpec } from './reportSpec';

const matches = (rule: ReportHighlight, value: number): boolean => {
  switch (rule.op) {
    case 'lt': return value < rule.value;
    case 'lte': return value <= rule.value;
    case 'gt': return value > rule.value;
    case 'gte': return value >= rule.value;
    case 'eq': return value === rule.value;
    case 'neq': return value !== rule.value;
    default: return false;
  }
};

/**
 * O tom da célula desta medida com este valor — a primeira regra que casa, ou nenhum.
 *
 * Valor ausente nunca ganha tom: "sem número" pintado de vermelho porque "menos que dez" seria um
 * alarme sobre o que não aconteceu. Uma regra de operador desconhecido não casa — é a degradação da
 * camada de apresentação, que nunca muda o número.
 */
export const reportHighlightTone = (
  spec: ReportSpec,
  measureKey: string,
  value: number | null | undefined,
): ReportHighlightTone | null => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  for (const rule of spec.presentation?.highlight ?? []) {
    if (rule.measure === measureKey && typeof rule.value === 'number' && matches(rule, value)) {
      return rule.tone;
    }
  }
  return null;
};
