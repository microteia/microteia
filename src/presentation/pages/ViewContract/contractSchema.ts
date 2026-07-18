import { deriveFormFields } from '../../shared/deriveEntitySchema';

/**
 * Campos do formulário de Contrato — derivados do ENTITY_REGISTRY (fonte única).
 * As sete relações (cliente, responsável e os cinco grupos de partes) são derivadas como
 * `reference`, com os grupos de partes em seleção múltipla.
 */
export const CONTRACT_FORM_FIELDS = deriveFormFields('contracts');
