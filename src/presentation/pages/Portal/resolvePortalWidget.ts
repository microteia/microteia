import { evaluatePortalCondition } from '../../../domain/schema/portal';
import {
  PORTAL_WIDGET_RECORDS_DEFAULT_LIMIT,
  type PortalCountNode,
  type PortalRecordsNode,
} from '../../../domain/schema/ui/portalWidget';
import type { PortalRecord } from '../../../domain/entities/Portal';

const passes = (record: PortalRecord, when: string | undefined, timeZone: string | undefined): boolean =>
  !when || evaluatePortalCondition(when, record.data, timeZone);

/** O valor como se compara: número, instante ou texto. Vazio é `null`, e vai sempre para o fim. */
const comparable = (value: unknown): number | string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return Array.isArray(value) ? value.join(', ') : String(value);
};

const compareValues = (a: unknown, b: unknown, direction: 'asc' | 'desc'): number => {
  const left = comparable(a);
  const right = comparable(b);
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  const order = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true });
  return direction === 'desc' ? -order : order;
};

/**
 * Os registros de um nó `records`: os que passam no `when` — avaliado sobre a PROJEÇÃO, no fuso do
 * escritório, e fechado na dúvida (a expressão que estoura não deixa passar) —, na ordem pedida, até o
 * limite. Sem `orderBy`, a ordem de chegada: os atualizados mais recentemente primeiro. O vazio vai para
 * o fim nas duas direções, e o empate guarda a ordem de chegada.
 */
export const selectPortalWidgetRecords = (
  records: readonly PortalRecord[],
  node: Pick<PortalRecordsNode, 'when' | 'orderBy' | 'limit'>,
  timeZone?: string,
): PortalRecord[] => {
  const matching = records.filter((record) => passes(record, node.when, timeZone));
  const { orderBy } = node;
  const ordered = orderBy
    ? [...matching].sort((a, b) => compareValues(a.data[orderBy.field], b.data[orderBy.field], orderBy.direction ?? 'asc'))
    : matching;
  return ordered.slice(0, node.limit ?? PORTAL_WIDGET_RECORDS_DEFAULT_LIMIT);
};

/**
 * Quantos registros passam no `when` de um `count`. Com `parentKey` (`scope: 'record'`), só os filhos
 * daquele registro — o pai como a projeção o grava (`colecao/id`).
 */
export const countPortalWidgetRecords = (
  records: readonly PortalRecord[],
  node: Pick<PortalCountNode, 'when'>,
  parentKey: string | null,
  timeZone?: string,
): number =>
  records.filter((record) => (parentKey === null || record.parentKeys.includes(parentKey)) && passes(record, node.when, timeZone)).length;
