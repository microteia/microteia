// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/clockGate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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
import { DEFAULT_TIME_ZONE } from './i18n/timeZone';

let ambient: Date | null = null;

/**
 * O FUSO em que `today()` diz que dia é — a outra metade do relógio. Um instante sozinho não tem
 * dia: o mesmo momento é 30/03 em Brasília e 31/03 em UTC.
 *
 * No front quem empurra é o `TenantLocaleProvider`, a partir da configuração `i18n.timezone`. No
 * backend ninguém o deixa empurrado: uma instância de Cloud Function atende escritórios diferentes
 * ao mesmo tempo. Lá o fuso entra por avaliação (`FieldExprContext.timeZone`) ou por
 * `withAmbientTimeZone`, que o empurra só durante um trecho SÍNCRONO — onde nada se intercala.
 */
let ambientZone: string | null = null;

/** O instante empurrado, ou `null` quando ninguém empurrou nenhum. É o que se restaura. */
export const configuredInstant = (): Date | null => ambient;

/** O instante a responder. Nunca `null`: quem avalia precisa de uma resposta. */
export const ambientInstant = (): Date => ambient ?? new Date();

export const setAmbientInstant = (at: Date | null): void => {
  ambient = at;
};

/** O fuso empurrado, ou `null` quando ninguém empurrou nenhum. É o que se restaura. */
export const configuredTimeZone = (): string | null => ambientZone;

/** O fuso a responder. Sem empurrão, UTC — o que `today()` sempre respondeu nas duas pontas. */
export const ambientTimeZone = (): string => ambientZone ?? DEFAULT_TIME_ZONE;

export const setAmbientTimeZone = (timeZone: string | null): void => {
  ambientZone = timeZone;
};

/**
 * Roda `run` com o fuso empurrado e o devolve ao anterior ao terminar. `run` precisa ser SÍNCRONO:
 * é isso que garante que nenhuma outra requisição avalie uma expressão no fuso deste escritório.
 * Sem fuso, roda sem empurrar nada.
 */
export const withAmbientTimeZone = <T>(timeZone: string | undefined, run: () => T): T => {
  if (!timeZone) return run();
  const previous = ambientZone;
  ambientZone = timeZone;
  try {
    return run();
  } finally {
    ambientZone = previous;
  }
};

/** Devolve o gate ao estado inicial. Existe para os testes não vazarem instante de um caso para outro. */
export const resetAmbientInstant = (): void => {
  ambient = null;
  ambientZone = null;
};
