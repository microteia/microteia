import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { usePersonStore } from '../../../stores/usePersonStore';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';
import { usePersonLookup } from '../../../stores/usePersonLookup';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { resolveListActions } from '../../shared/listActionCapabilities';
import { useNotification } from '../../../stores/useNotification';
import { useCustomFieldListing, CUSTOM_FIELD_FILTER_PREFIX } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { format } from 'date-fns';
import type { Person } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { PERSON_LIST_CONFIG } from './personSchema';
import type { PersonCardActionKey } from './personSchema';

const PERSON_STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'Ativo', label: 'Ativos' },
  { value: 'Inativo', label: 'Inativos' },
];

const readFieldPath = (obj: unknown, key: string): unknown => {
  let cursor: unknown = obj;
  for (const part of key.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
};

const formatFieldValue = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (raw instanceof Date) return format(raw, 'dd/MM/yyyy');
  if (Array.isArray(raw)) return raw.map((item) => String(item)).join(' · ');
  return String(raw);
};

export interface PersonCardAction {
  key: PersonCardActionKey;
  title: string;
  danger?: boolean;
  onClick: () => void;
}

export interface PersonCardMetaRow {
  key: string;
  iconKey: string;
  value: string;
}

export interface PersonCardModel {
  avatar: string;
  title: string;
  subtitle: { iconKey: string; text: string };
  metaRows: PersonCardMetaRow[];
  tags: { id: string; name: string; color: string }[];
  actions: PersonCardAction[];
}

export interface PersonsViewModel {
  persons: Person[];
  filteredPersons: Person[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  isAdmin: boolean;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewPerson: () => void;
  openPerson: (person: Person) => void;
  getRelationshipColor: (relationship?: string | null) => string;
  getCustomFieldItems: (person: Person) => CustomFieldCardItem[];
  getCardModel: (person: Person) => PersonCardModel;
  tagManagerPerson: Person | null;
  tagAdapter: TagStoreAdapter;
  closeTagManager: () => void;
  personToDelete: Person | null;
  isDeleting: boolean;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;
}

export const usePersonsViewModel = (): PersonsViewModel => {
  const { persons, isLoading, deletePerson } = usePersonStore();
  const { tags, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag } = usePersonTagStore();
  const { typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs } = usePersonLookup();
  const { tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const { getCustomFieldsFor, getDefinition } = useScreenDefinitions();
  const { notify } = useNotification();
  const theme = useTheme();

  const [tagManagerPerson, setTagManagerPerson] = useState<Person | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const customFields = useMemo(() => getCustomFieldsFor('persons'), [getCustomFieldsFor]);
  const customListing = useCustomFieldListing('persons', customFields, CUSTOM_FIELD_FILTER_PREFIX);

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const isAdmin = tenantRole === 'admin';

  const tagOptions = useMemo<FilterDef['options']>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const typeOptions = useMemo<FilterDef['options']>(() =>
    typeConfigs.map((c) => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );

  const occupationOptions = useMemo<FilterDef['options']>(() =>
    occupationConfigs.map((c) => ({ value: c.key, label: c.label })),
    [occupationConfigs],
  );

  const nationalityOptions = useMemo<FilterDef['options']>(() =>
    nationalityConfigs.map((c) => ({ value: c.key, label: c.label })),
    [nationalityConfigs],
  );

  const maritalStatusOptions = useMemo<FilterDef['options']>(() =>
    maritalStatusConfigs.map((c) => ({ value: c.key, label: c.label })),
    [maritalStatusConfigs],
  );

  const cityOptions = useMemo<FilterDef['options']>(() =>
    cityConfigs.map((c) => ({ value: c.key, label: c.label })),
    [cityConfigs],
  );

  const relationshipOptions = useMemo<FilterDef['options']>(() =>
    relationshipConfigs.map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [relationshipConfigs, theme],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search',       label: 'Busca',          type: 'text',   placeholder: 'Nome, CPF, CNPJ, e-mail, telefone...' },
    { key: 'type',         label: 'Tipo',            type: 'select', options: typeOptions },
    { key: 'status',       label: 'Status',          type: 'select', options: PERSON_STATUS_OPTIONS },
    { key: 'occupation',   label: 'Profissão',       type: 'select', options: occupationOptions },
    { key: 'nationality',  label: 'Nacionalidade',   type: 'select', options: nationalityOptions },
    { key: 'maritalStatus',label: 'Estado Civil',    type: 'select', options: maritalStatusOptions },
    { key: 'city',         label: 'Cidade',          type: 'select', options: cityOptions },
    { key: 'relationship', label: 'Relacionamento',  type: 'select', options: relationshipOptions },
    ...((tagOptions ?? []).length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
    ...customListing.filterDefs,
  ], [typeOptions, occupationOptions, nationalityOptions, maritalStatusOptions, cityOptions, relationshipOptions, tagOptions, customListing.filterDefs]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredPersons = useMemo(() => {
    const searchQ        = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const typeFilter     = tokenMap['type']         ?? [];
    const statusFilter   = tokenMap['status']       ?? [];
    const occFilter      = tokenMap['occupation']   ?? [];
    const natFilter      = tokenMap['nationality']  ?? [];
    const msFilter       = tokenMap['maritalStatus']?? [];
    const cityFilter     = tokenMap['city']         ?? [];
    const relFilter      = tokenMap['relationship'] ?? [];
    const tagFilter      = tokenMap['tag']          ?? [];

    return persons.filter((c) => {
      if (searchQ && !c.name.toLowerCase().includes(searchQ) &&
        !(c.email?.toLowerCase().includes(searchQ)) &&
        !(c.cpf?.includes(searchQ)) &&
        !(c.cnpj?.includes(searchQ)) &&
        !(c.phone?.includes(searchQ))) return false;
      if (typeFilter.length     > 0 && !typeFilter.includes(c.type)) return false;
      if (statusFilter.length   > 0 && !statusFilter.includes(c.status)) return false;
      if (occFilter.length      > 0 && !occFilter.includes(c.occupation ?? '')) return false;
      if (natFilter.length      > 0 && !natFilter.includes(c.nationality ?? '')) return false;
      if (msFilter.length       > 0 && !msFilter.includes(c.maritalStatus ?? '')) return false;
      if (cityFilter.length     > 0 && !cityFilter.includes(c.address?.city ?? '')) return false;
      if (relFilter.length      > 0 && !relFilter.includes(c.relationship ?? '')) return false;
      if (tagFilter.length      > 0 && !tagFilter.some((tid) => c.tagIds?.includes(tid))) return false;
      return customListing.matchesFilters(c.customValues, tokenMap);
    });
  }, [persons, tokenMap, customListing]);

  const openNewPerson = useCallback(() => openTab('new-person'), [openTab]);
  const openPerson = useCallback((person: Person) => openTab(`view-person:${person.id}`), [openTab]);

  const getRelationshipColor = useCallback((relationship?: string | null): string => {
    if (!relationship) return theme.colors.relationshipDefault;
    return getConfigColor(relationshipConfigs, relationship, theme, theme.colors.relationshipDefault);
  }, [relationshipConfigs, theme]);

  const getCustomFieldItems = useCallback(
    (person: Person): CustomFieldCardItem[] => customListing.cardItems(person.customValues),
    [customListing],
  );

  const resolveRow = useCallback((person: Person, key: string): string => {
    const direct = readFieldPath(person, key);
    const raw = direct === undefined ? person.customValues?.[key] : direct;
    return formatFieldValue(raw);
  }, []);

  const onCopyLink = useCallback((person: Person) => {
    void navigator.clipboard.writeText(generateDeepLink(`view-person:${person.id}`));
    notify('Link copiado para a área de transferência.', 'success');
  }, [notify]);

  const onClone = useCallback((person: Person) => {
    openTab(`new-person:clone:${person.id}`);
  }, [openTab]);

  const buildCardActions = useCallback((person: Person): PersonCardAction[] => {
    const handlers: Record<PersonCardActionKey, PersonCardAction> = {
      copyLink: { key: 'copyLink', title: 'Copiar link', onClick: () => onCopyLink(person) },
      clone: { key: 'clone', title: 'Duplicar', onClick: () => onClone(person) },
      manageTags: { key: 'manageTags', title: 'Gerenciar etiquetas', onClick: () => setTagManagerPerson(person) },
      delete: { key: 'delete', title: 'Excluir', danger: true, onClick: () => setPersonToDelete(person) },
    };
    return resolveListActions('persons', getDefinition('persons')?.listActions)
      .filter((action) => action !== 'delete' || isAdmin)
      .map((action) => handlers[action]);
  }, [onCopyLink, onClone, isAdmin, getDefinition]);

  const getCardModel = useCallback((person: Person): PersonCardModel => ({
    avatar: (person.name || '?').charAt(0).toUpperCase(),
    title: person.name,
    subtitle: { iconKey: PERSON_LIST_CONFIG.subtitle.icon, text: resolveRow(person, PERSON_LIST_CONFIG.subtitle.key) },
    metaRows: PERSON_LIST_CONFIG.rows
      .map((row) => ({ key: row.key, iconKey: row.icon, value: resolveRow(person, row.key) }))
      .filter((row) => row.value !== ''),
    tags: PERSON_LIST_CONFIG.showTags
      ? tags.filter((t) => person.tagIds?.includes(t.id)).map((t) => ({ id: t.id, name: t.name, color: t.color }))
      : [],
    actions: buildCardActions(person),
  }), [resolveRow, tags, buildCardActions]);

  const tagAdapter = useMemo<TagStoreAdapter>(() => ({
    tags,
    getAppliedTags: (entityId: string) => {
      const target = persons.find((p) => p.id === entityId);
      return getTagsForPerson(entityId, target?.tagIds ?? []);
    },
    setTags: (entityId: string, tagIds: string[]) => setTagsForPerson(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, persons, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag]);

  const closeTagManager = useCallback(() => setTagManagerPerson(null), []);
  const cancelDeletePerson = useCallback(() => setPersonToDelete(null), []);

  const confirmDeletePerson = useCallback(async () => {
    if (!personToDelete) return;
    setIsDeleting(true);
    try {
      await deletePerson(personToDelete.id);
      notify('Pessoa excluída.', 'success');
      setPersonToDelete(null);
    } catch {
      notify('Erro ao excluir pessoa.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [personToDelete, deletePerson, notify]);

  return {
    persons,
    filteredPersons,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'persons',
    isAdmin,
    setFilterTokens,
    openNewPerson,
    openPerson,
    getRelationshipColor,
    getCustomFieldItems,
    getCardModel,
    tagManagerPerson,
    tagAdapter,
    closeTagManager,
    personToDelete,
    isDeleting,
    confirmDeletePerson,
    cancelDeletePerson,
  };
};
