import { deriveFormFields } from '../../shared/deriveEntitySchema';

/**
 * Campos do formulário de Prazo — derivados do ENTITY_REGISTRY (fonte única),
 * incluindo as relações (`fks`) Processo e Advogado responsável como campos `reference`.
 */
export const DEADLINE_FORM_FIELDS = deriveFormFields('deadlines');
