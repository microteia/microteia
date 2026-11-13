// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowParallel.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowParallel.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RAMOS PARALELOS — o nó `Parallel`, cujos ramos rodam AO MESMO TEMPO e se juntam no fim, e a concorrência
 * do laço (`loop.concurrency`), que processa vários itens de uma vez.
 *
 * O ganho é de TEMPO, nunca de capacidade: tudo o que o paralelo faz já se fazia em sequência. Vale quando
 * os passos esperam alguém de fora — uma API, um modelo de IA —, e três consultas de 3 s viram 3 s, e não 9.
 *
 * As regras que o tornam seguro:
 * - cada ramo (e cada iteração concorrente) roda num CONTEXTO PRÓPRIO: um passo de um ramo não vê o que o
 *   ramo vizinho está fazendo, e não pode ler a saída dele — não há ordem entre os dois;
 * - o nó espera TODOS os ramos, e só então as saídas deles entram no contexto, na ORDEM DECLARADA dos ramos
 *   (nunca na de chegada): a mesma automação dá sempre o mesmo resultado;
 * - um ramo que falha falha o nó, depois de os outros terminarem — um passo que já gravou não é desfeito;
 * - nada que PAUSA cabe dentro (espera, aprovação, esperar evento, laço paginado): a retomada não sabe
 *   continuar vários ramos;
 * - "Encerrar" dentro de um ramo encerra a automação, depois da junção.
 */

/** O kernel a partir do qual existem o nó `Parallel` e `loop.concurrency`. */
export const WORKFLOW_PARALLEL_SINCE_KERNEL = '2.127.0';

/** Ramos de um nó. Menos de dois não é paralelo; mais que isso é uma automação que pede outra forma. */
export const MIN_PARALLEL_BRANCHES = 2;
export const MAX_PARALLEL_BRANCHES = 8;

/** Itens de um laço processados ao mesmo tempo. O teto protege a API do outro lado tanto quanto o motor. */
export const MAX_LOOP_CONCURRENCY = 10;

/** A concorrência declarada do laço: 1 (em sequência, como sempre) quando ausente ou inválida; no máximo o teto. */
export const loopConcurrencyOf = (declared: unknown): number => {
  const value = typeof declared === 'number' ? declared : Number.NaN;
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_LOOP_CONCURRENCY);
};

/**
 * O id do próximo ramo de um nó: `r1`, `r2`... O id vai no endereço de arrastar (`{nodeId}:lane.{id}`),
 * por isso é curto e sem `:`.
 */
export const nextParallelBranchId = (taken: readonly string[]): string => {
  const used = new Set(taken);
  let index = 1;
  while (used.has(`r${index}`)) index += 1;
  return `r${index}`;
};
