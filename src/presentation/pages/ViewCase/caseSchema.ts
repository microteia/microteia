import { deriveFormFields } from '../../shared/deriveEntitySchema';

/**
 * Campos do formulário de Processo — derivados do ENTITY_REGISTRY (fonte única).
 * Os polos ativo/passivo são relações `multi` para `persons`, derivadas como `reference` múltiplo.
 */
export const CASE_FORM_FIELDS = deriveFormFields('cases');
