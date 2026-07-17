import type { FieldDefinition } from '../../../domain/entities';
import { deriveFormFields } from '../../shared/deriveEntitySchema';

// Derivado da fonte única (ENTITY_REGISTRY.persons). Para ajustar um campo, edite o `ui`/`logic`
// do campo no registry. Overrides/campos exclusivos da view entrariam via deriveFormFields(opts).
export const PERSON_FORM_FIELDS: FieldDefinition[] = deriveFormFields('persons');
