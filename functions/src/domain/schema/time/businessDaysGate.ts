// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/time/businessDaysGate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/time/businessDaysGate.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessCalendarSet } from './businessDays';

/**
 * Os calendários de dias úteis em que a expressão está sendo avaliada, como contexto de módulo.
 *
 * Existe pelo mesmo motivo de `clockGate.ts`: o `expr-eval` não entrega o escopo às funções que se
 * registram nele, e `addBusinessDays` precisa dos calendários sem que a fórmula os passe.
 *
 * `null` quer dizer "nenhuma extensão declarou calendários" — e a conta recusa com `unavailable`, nunca
 * conta como se não houvesse dia não útil.
 *
 * No front quem empurra é o provedor que assina a coleção declarada. No backend ninguém o deixa
 * empurrado: uma instância de Cloud Function atende escritórios diferentes ao mesmo tempo. Lá ele entra
 * por avaliação (`FieldExprContext.businessCalendars`) ou por `withAmbientBusinessCalendars`, só
 * durante um trecho SÍNCRONO.
 */
let ambient: BusinessCalendarSet | null = null;

export const ambientBusinessCalendars = (): BusinessCalendarSet | null => ambient;

export const setAmbientBusinessCalendars = (set: BusinessCalendarSet | null): void => {
  ambient = set;
};

/**
 * Roda `run` com os calendários empurrados e devolve o gate ao anterior ao terminar. `run` precisa ser
 * SÍNCRONO: é isso que garante que nenhuma outra requisição conte dias com os calendários deste
 * escritório. Sem conjunto, roda sem empurrar nada.
 */
export const withAmbientBusinessCalendars = <T>(set: BusinessCalendarSet | null | undefined, run: () => T): T => {
  if (!set) return run();
  const previous = ambient;
  ambient = set;
  try {
    return run();
  } finally {
    ambient = previous;
  }
};
