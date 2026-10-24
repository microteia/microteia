import { Timestamp } from 'firebase/firestore';
import type { PortalRecord } from '../../domain/entities/Portal';
import { toPlainValues } from '../utils/plainValues';

export const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
export const dateOf = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);
export const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * A PROJEÇÃO como o front a entrega — ao portal nativo e às views de extensão. O `data` atravessa
 * `toPlainValues`, a mesma fronteira dos registros do escritório: um campo de data chega como `Date`,
 * e não como o Timestamp que o `formatDate` e a comparação de dias não sabiam ler.
 */
export const mapPortalRecord = (id: string, data: Record<string, unknown>): PortalRecord => ({
  id,
  collection: textOf(data.collection),
  recordId: textOf(data.recordId),
  screenId: textOf(data.screenId),
  title: textOf(data.title),
  data: (toPlainValues(data.data ?? {}) as Record<string, unknown>),
  labels: (data.labels as Record<string, string> | undefined) ?? {},
  // Projeções gravadas antes do campo: o sujeito é o pai de quem aponta direto para a tela-sujeito,
  // que é o caso comum. O resto se acerta na próxima gravação do registro.
  parentKeys: stringsOf(data.parentKeys).length > 0 ? stringsOf(data.parentKeys) : stringsOf(data.subjectKeys),
  editable: data.editable === true,
  portalOwner: textOf(data.portalOwner) || null,
  updatedAt: dateOf(data.updatedAt),
});
