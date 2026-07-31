import { deriveBuiltinListRows, type DerivedListRow } from '../../shared/deriveEntitySchema';

/**
 * Linhas do card de Prazo — derivadas de `ui.list` no ENTITY_REGISTRY, inclusive as relações
 * (Processo e Advogado responsável, resolvidas de ID para rótulo).
 * Exclusivo da tela e montado na view: a faixa de prioridade (`accentColor`), os badges de
 * status/prioridade (`belowHeader`) e o número do processo clicável com o chip de dias (`subtitle`).
 */
export const DEADLINE_LIST_ROWS: DerivedListRow[] = deriveBuiltinListRows('deadlines');
