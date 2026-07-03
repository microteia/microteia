import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PersonStoreContext } from './usePersonStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetPersonsUseCase } from '../domain/usecases/persons/GetPersonsUseCase';
import { makeCreatePersonUseCase } from '../domain/usecases/persons/CreatePersonUseCase';
import { makeUpdatePersonUseCase } from '../domain/usecases/persons/UpdatePersonUseCase';
import { makeDeletePersonUseCase } from '../domain/usecases/persons/DeletePersonUseCase';
import type { DeletionActor, Person, PersonStatus } from '../domain/entities';

export const PersonStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { personRepository, caseRepository, deadlineRepository, financialRepository } = useDI();

  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetPersonsUseCase(personRepository),
    create: makeCreatePersonUseCase(personRepository),
    update: makeUpdatePersonUseCase(personRepository),
    delete: makeDeletePersonUseCase(personRepository, caseRepository, deadlineRepository, financialRepository),
  }), [personRepository, caseRepository, deadlineRepository, financialRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setPersons(list);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.PERSONS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const createPerson = useCallback(async (data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setPersons((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    storeEvents.emit(StoreEvents.PERSONS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updatePerson = useCallback(async (personId: string, data: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, personId, data);
    setPersons((prev) => prev.map((c) => c.id === personId ? { ...c, ...data } : c));
    storeEvents.emit(StoreEvents.PERSONS_UPDATED);
  }, [currentTenant, uc.update]);

  const updatePersonStatus = useCallback(async (personId: string, status: PersonStatus) => {
    if (!currentTenant) return;
    await personRepository.updatePersonStatus(currentTenant.id, personId, status);
    setPersons((prev) => prev.map((c) => c.id === personId ? { ...c, status } : c));
    storeEvents.emit(StoreEvents.PERSONS_UPDATED);
  }, [currentTenant, personRepository]);

  const deletePerson = useCallback(async (personId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, personId, actor);
    setPersons((prev) => prev.filter((c) => c.id !== personId));
    storeEvents.emit(StoreEvents.PERSONS_UPDATED);
    storeEvents.emit(StoreEvents.CASES_UPDATED);
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.delete, user, effectiveName]);

  return (
    <PersonStoreContext.Provider value={{ persons, isLoading, createPerson, updatePerson, updatePersonStatus, deletePerson, refresh }}>
      {children}
    </PersonStoreContext.Provider>
  );
};
