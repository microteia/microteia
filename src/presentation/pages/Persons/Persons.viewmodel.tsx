import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { usePersonStore } from '../../../stores/usePersonStore';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';
import { usePersonLookup } from '../../../stores/usePersonLookup';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { resolveColor } from '../../../shared/styles/colorUtils';
import type { Person } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

const PERSON_STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'Ativo', label: 'Ativos' },
  { value: 'Inativo', label: 'Inativos' },
];

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
}

export const usePersonsViewModel = (): PersonsViewModel => {
  const { persons, isLoading } = usePersonStore();
  const { tags } = usePersonTagStore();
  const { typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs } = usePersonLookup();
  const { tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const theme = useTheme();

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
  ], [typeOptions, occupationOptions, nationalityOptions, maritalStatusOptions, cityOptions, relationshipOptions, tagOptions]);

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
      return true;
    });
  }, [persons, tokenMap]);

  const openNewPerson = useCallback(() => openTab('new-person'), [openTab]);
  const openPerson = useCallback((person: Person) => openTab(`view-person:${person.id}`), [openTab]);

  const getRelationshipColor = useCallback((relationship?: string | null): string => {
    if (!relationship) return theme.colors.relationshipDefault;
    const config = relationshipConfigs.find((c) => c.key === relationship);
    if (!config?.color) return theme.colors.relationshipDefault;
    return (theme.colors as Record<string, string>)[config.color] ?? theme.colors.relationshipDefault;
  }, [relationshipConfigs, theme]);

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
  };
};
