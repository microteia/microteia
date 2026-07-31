import { deriveBuiltinListRows, type DerivedListRow } from '../../shared/deriveEntitySchema';

/**
 * Linhas do card de Contrato — derivadas de `ui.list` no ENTITY_REGISTRY.
 * Exceções que seguem na view por serem composições de dois campos ou exclusivas da tela:
 * o intervalo de vigência (início – fim, que como duas linhas separadas ficaria ambíguo sem rótulo),
 * os badges de status/tipo e as colunas Contratante/Contratado — estes últimos via `belowHeader`.
 */
export const CONTRACT_LIST_ROWS: DerivedListRow[] = deriveBuiltinListRows('contracts');
