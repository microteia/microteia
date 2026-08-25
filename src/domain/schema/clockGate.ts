// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/clockGate.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O INSTANTE em que a expressão está sendo avaliada, como contexto de módulo.
 *
 * Existe pelo mesmo motivo de `access/permissionGate.ts`: `today()` e `now()` precisam ser FUNÇÕES
 * DE EXPRESSÃO, e o avaliador (`expr-eval`) não entrega o escopo às funções que se registram nele.
 * O instante chega por empurrão de quem o conhece — `evaluateFieldExpression` o empurra quando o
 * contexto o traz, e o devolve ao valor anterior ao terminar.
 *
 * Antes de alguém empurrar um instante, a resposta é o relógio: um `compute` que roda na gravação
 * fala do momento da gravação, e é isso que ele sempre fez. Quem PRECISA de um instante fixo é a
 * derivação na leitura (`logic.derive`): todos os registros de uma mesma lista têm de responder
 * sobre o mesmo momento, senão dois registros vizinhos discordariam sobre que dia é hoje quando a
 * lista atravessa a meia-noite. É também o que torna o comportamento testável sem congelar relógio.
 */
let ambient: Date | null = null;

/** O instante empurrado, ou `null` quando ninguém empurrou nenhum. É o que se restaura. */
export const configuredInstant = (): Date | null => ambient;

/** O instante a responder. Nunca `null`: quem avalia precisa de uma resposta. */
export const ambientInstant = (): Date => ambient ?? new Date();

export const setAmbientInstant = (at: Date | null): void => {
  ambient = at;
};

/** Devolve o gate ao estado inicial. Existe para os testes não vazarem instante de um caso para outro. */
export const resetAmbientInstant = (): void => {
  ambient = null;
};
