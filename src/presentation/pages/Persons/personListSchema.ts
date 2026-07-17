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

export const PERSON_LIST_CONFIG: PersonListConfig = {
  titleKey: 'name',
  subtitle: { key: 'type', icon: 'user' },
  showTags: true,
  actions: ['copyLink', 'clone', 'manageTags', 'delete'],
  rows: [
    { key: 'document', icon: 'contacts' },
    { key: 'email', icon: 'mail' },
    { key: 'phone', icon: 'phone' },
    { key: 'occupation', icon: 'briefcase' },
    { key: 'city', icon: 'map' },
  ],
};
