import { deriveListRows, type DerivedListRow } from '../../shared/deriveEntitySchema';

/**
 * Linhas do card de Lançamento — derivadas de `ui.list` no ENTITY_REGISTRY.
 * Este card é o mais navegacional dos quatro: Pessoa, Processo e Contrato são **links** que abrem o
 * registro, e a linha de datas combina vencimento/pagamento/cancelamento com cores distintas — por
 * isso seguem montados na view. O valor vai no `footer` (com sinal e cor por tipo) e a categoria é o
 * título. Campos simples novos aparecem no card só declarando `ui.list` no registry.
 */
export const FINANCIAL_LIST_ROWS: DerivedListRow[] = deriveListRows('financials');
