import type { FieldDefinition } from '../../../domain/entities';
import { deriveFormFields, deriveListRows } from '../../shared/deriveEntitySchema';

// Form e List de Pessoas derivam da fonte única (ENTITY_REGISTRY.persons — regras no campo, apresentação no `ui`).
// Para ajustar um campo, edite o campo no registry. Overrides/campos exclusivos entrariam via deriveFormFields(opts).

export const PERSON_FORM_FIELDS: FieldDefinition[] = deriveFormFields('persons');

export type PersonCardActionKey = 'copyLink' | 'clone' | 'manageTags' | 'delete';

export interface PersonCardRow {
  key: string;
  icon: string;
}

export interface PersonListConfig {
  titleKey: string;
  subtitle: { key: string; icon: string };
  showTags: boolean;
  rows: PersonCardRow[];
}

// Título/subtítulo/etiquetas são configuração de nível de card; as linhas derivam do registry
// (`ui.list`) e as ações vêm da configuração da tela (ScreenDefinition.listActions).
export const PERSON_LIST_CONFIG: PersonListConfig = {
  titleKey: 'name',
  subtitle: { key: 'type', icon: 'user' },
  showTags: true,
  rows: deriveListRows('persons'),
};
