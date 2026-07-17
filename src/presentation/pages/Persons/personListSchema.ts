import { deriveListRows } from '../../shared/deriveEntitySchema';

export type PersonCardActionKey = 'copyLink' | 'clone' | 'manageTags' | 'delete';

export interface PersonCardRow {
  key: string;
  icon: string;
}

export interface PersonListConfig {
  titleKey: string;
  subtitle: { key: string; icon: string };
  showTags: boolean;
  actions: PersonCardActionKey[];
  rows: PersonCardRow[];
}

// As linhas (campos + ícone + ordem) derivam da fonte única (ENTITY_REGISTRY.persons, via `ui.list`).
// Título/subtítulo/etiquetas/ações são configuração de nível de card.
export const PERSON_LIST_CONFIG: PersonListConfig = {
  titleKey: 'name',
  subtitle: { key: 'type', icon: 'user' },
  showTags: true,
  actions: ['manageTags'],
  rows: deriveListRows('persons'),
};
