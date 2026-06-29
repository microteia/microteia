import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { PersonLookupContext } from './usePersonLookup';
import type { PersonLookupConfig, PersonLookupKind } from '../domain/entities';

export const PersonLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { personLookupRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [typeConfigs,          setTypeConfigs]          = useState<PersonLookupConfig[]>([]);
  const [occupationConfigs,    setOccupationConfigs]    = useState<PersonLookupConfig[]>([]);
  const [nationalityConfigs,   setNationalityConfigs]   = useState<PersonLookupConfig[]>([]);
  const [maritalStatusConfigs, setMaritalStatusConfigs] = useState<PersonLookupConfig[]>([]);
  const [cityConfigs,          setCityConfigs]          = useState<PersonLookupConfig[]>([]);
  const [relationshipConfigs,  setRelationshipConfigs]  = useState<PersonLookupConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [types, occupations, nationalities, maritalStatuses, cities, relationships] = await Promise.all([
        personLookupRepository.getAll(currentTenant.id, 'types'),
        personLookupRepository.getAll(currentTenant.id, 'occupations'),
        personLookupRepository.getAll(currentTenant.id, 'nationalities'),
        personLookupRepository.getAll(currentTenant.id, 'maritalStatuses'),
        personLookupRepository.getAll(currentTenant.id, 'cities'),
        personLookupRepository.getAll(currentTenant.id, 'relationships'),
      ]);
      setTypeConfigs(types);
      setOccupationConfigs(occupations);
      setNationalityConfigs(nationalities);
      setMaritalStatusConfigs(maritalStatuses);
      setCityConfigs(cities);
      setRelationshipConfigs(relationships);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, personLookupRepository]);

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on tenant change is architecturally required
    void refresh();
  }, [currentTenant, refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const addItem = useCallback(async (kind: PersonLookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const config = await personLookupRepository.create(currentTenant.id, kind, name, user.id);
    switch (kind) {
      case 'types':          setTypeConfigs(prev          => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
      case 'occupations':    setOccupationConfigs(prev    => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
      case 'nationalities':  setNationalityConfigs(prev   => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
      case 'maritalStatuses':setMaritalStatusConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
      case 'cities':         setCityConfigs(prev          => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
      case 'relationships':  setRelationshipConfigs(prev  => [...prev, config].sort((a, b) => a.label.localeCompare(b.label))); break;
    }
  }, [currentTenant, user, personLookupRepository]);

  const removeItem = useCallback(async (kind: PersonLookupKind, key: string) => {
    if (!currentTenant) return;
    await personLookupRepository.delete(currentTenant.id, kind, key);
    switch (kind) {
      case 'types':          setTypeConfigs(prev          => prev.filter(i => i.key !== key)); break;
      case 'occupations':    setOccupationConfigs(prev    => prev.filter(i => i.key !== key)); break;
      case 'nationalities':  setNationalityConfigs(prev   => prev.filter(i => i.key !== key)); break;
      case 'maritalStatuses':setMaritalStatusConfigs(prev => prev.filter(i => i.key !== key)); break;
      case 'cities':         setCityConfigs(prev          => prev.filter(i => i.key !== key)); break;
      case 'relationships':  setRelationshipConfigs(prev  => prev.filter(i => i.key !== key)); break;
    }
  }, [currentTenant, personLookupRepository]);

  return (
    <PersonLookupContext.Provider value={{
      typeConfigs,
      occupationConfigs,
      nationalityConfigs,
      maritalStatusConfigs,
      cityConfigs,
      relationshipConfigs,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </PersonLookupContext.Provider>
  );
};
