import { deriveListRows, type DerivedListRow } from '../../shared/deriveEntitySchema';
import { formatCurrencyBRL } from '../../../utils/formatters';
import { format } from 'date-fns';

/**
 * Linhas do card de Processo — derivadas de `ui.list` no ENTITY_REGISTRY.
 * Para incluir/remover/reordenar uma linha, edite `ui.list` do campo no registry (não esta view).
 * O que é exclusivo do Processo (chip de dias, badges de status/fase, polos) entra pelo slot
 * `belowHeader` do EntityListCard — customização pontual sem abrir mão do resto.
 */
export const CASE_LIST_ROWS: DerivedListRow[] = deriveListRows('cases');

/** Formata o valor conforme o controle declarado no registry (moeda, data, lista…). */
export const formatListValue = (raw: unknown, type: DerivedListRow['type']): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (type === 'currency') return typeof raw === 'number' ? formatCurrencyBRL(raw) : '';
  if (raw instanceof Date) return format(raw, 'dd/MM/yyyy');
  if (Array.isArray(raw)) return raw.map((item) => String(item)).join(' · ');
  return String(raw);
};
