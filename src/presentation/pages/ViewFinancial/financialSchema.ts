import { deriveFormFields } from '../../shared/deriveEntitySchema';

/**
 * Campos do formulário de Lançamento — derivados do ENTITY_REGISTRY (fonte única),
 * incluindo as relações (`fks`) Processo, Pessoa e Contrato como campos `reference`.
 */
export const FINANCIAL_FORM_FIELDS = deriveFormFields('financials');
