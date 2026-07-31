import { deriveBuiltinListRows } from '../../shared/deriveEntitySchema';

// A listagem de Pessoas deriva da fonte única (ENTITY_REGISTRY.persons — regras no campo,
// apresentação no `ui`). Os campos do FORMULÁRIO vêm de `useEntityFormFields`, que aplica também
// os ajustes do Form Design.

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
  rows: deriveBuiltinListRows('persons'),
};
