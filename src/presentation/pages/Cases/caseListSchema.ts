import { deriveListRows, type DerivedListRow } from '../../shared/deriveEntitySchema';

/**
 * Linhas do card de Processo — derivadas de `ui.list` no ENTITY_REGISTRY, inclusive as relações
 * (o advogado responsável). Para incluir/remover/reordenar uma linha, edite `ui.list` do campo no
 * registry — nunca esta view. O que é exclusivo do Processo (chip de dias em trâmite, badges de
 * status/fase e os polos) entra pelo slot `belowHeader` do EntityListCard.
 */
export const CASE_LIST_ROWS: DerivedListRow[] = deriveListRows('cases');
