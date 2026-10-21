// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordOrder.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordOrder.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { compareValues } from './predicateMatch';
import type { QueryOrderBy } from './querySpec';

/**
 * A ordem DETERMINÍSTICA entre registros: as chaves declaradas, e depois um desempate fixo.
 *
 * Nasceu no `latest` da agregação e foi extraída quando o dataset do modelo de documento passou a
 * dizer "mais recente" com a mesma lista: dois lugares que ordenam a mesma pergunta não podem
 * discordar sobre qual registro vem primeiro.
 */

const isEmptyOrderValue = (value: unknown): boolean =>
  value === null
  || value === undefined
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);

/** O carimbo do Firestore chega como `Timestamp`; ordená-lo é ordenar o instante dele. */
const asComparable = (value: unknown): unknown => {
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value;
};

/**
 * Ordem entre dois valores de uma chave, já na direção pedida. Vazio vai para o FIM nas duas
 * direções — um registro sem data não é nem o mais antigo nem o mais recente, e deixá-lo vencer um
 * `asc` faria o "primeiro" ser justamente o registro incompleto. Valores incomparáveis empatam e
 * passam para a chave seguinte.
 */
const compareOrderValue = (left: unknown, right: unknown, dir: QueryOrderBy['dir']): number => {
  const leftEmpty = isEmptyOrderValue(left);
  const rightEmpty = isEmptyOrderValue(right);
  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
  const order = compareValues(asComparable(left), asComparable(right)) ?? 0;
  return dir === 'desc' ? -order : order;
};

const compareIds = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * O comparador: depois das chaves declaradas vem o `createdAt`, na direção da ÚLTIMA chave (o mais
 * recente registrado vence um `desc`, o mais antigo vence um `asc`), e por fim o id do documento,
 * crescente — que é único. O resultado não muda só porque o banco devolveu os registros em outra
 * ordem.
 */
export const deterministicRecordOrder = <T>(
  orderBy: readonly QueryOrderBy[],
  valueOf: (item: T, path: string) => unknown,
  idOf: (item: T) => string,
): ((left: T, right: T) => number) => {
  const tieDir = orderBy[orderBy.length - 1]?.dir ?? 'desc';
  return (left, right) => {
    for (const order of orderBy) {
      const result = compareOrderValue(valueOf(left, order.path), valueOf(right, order.path), order.dir);
      if (result !== 0) return result;
    }
    const created = compareOrderValue(valueOf(left, 'createdAt'), valueOf(right, 'createdAt'), tieDir);
    if (created !== 0) return created;
    return compareIds(idOf(left), idOf(right));
  };
};
