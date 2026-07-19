import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { PersonLookupContext } from './usePersonLookup';
import type { PersonLookupConfig, PersonLookupKind } from '../domain/entities';

const KINDS: PersonLookupKind[] = [
  'types', 'occupations', 'nationalities', 'maritalStatuses',
  'cities', 'relationships', 'genders',
];

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
  const [genderConfigs,        setGenderConfigs]        = useState<PersonLookupConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setTypeConfigs([]);
      setOccupationConfigs([]);
      setNationalityConfigs([]);
      setMaritalStatusConfigs([]);
      setCityConfigs([]);
      setRelationshipConfigs([]);
      setGenderConfigs([]);
      return;
    }
    setLoading(true);
    const setters: Record<PersonLookupKind, React.Dispatch<React.SetStateAction<PersonLookupConfig[]>>> = {
      types:           setTypeConfigs,
      occupations:     setOccupationConfigs,
      nationalities:   setNationalityConfigs,
      maritalStatuses: setMaritalStatusConfigs,
      cities:          setCityConfigs,
      relationships:   setRelationshipConfigs,
      genders:         setGenderConfigs,
    };
    const unsubscribes = KINDS.map((kind) => personLookupRepository.subscribe(currentTenant.id, kind, (items) => {
      setters[kind](items);
      setLoading(false);
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, personLookupRepository]);

  const addItem = useCallback(async (kind: PersonLookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    await personLookupRepository.create(currentTenant.id, kind, name, user.id);
  }, [currentTenant, user, personLookupRepository]);

  const removeItem = useCallback(async (kind: PersonLookupKind, key: string) => {
    if (!currentTenant) return;
    await personLookupRepository.delete(currentTenant.id, kind, key);
  }, [currentTenant, personLookupRepository]);

  return (
    <PersonLookupContext.Provider value={{
      typeConfigs,
      occupationConfigs,
      nationalityConfigs,
      maritalStatusConfigs,
      cityConfigs,
      relationshipConfigs,
      genderConfigs,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </PersonLookupContext.Provider>
  );
};
