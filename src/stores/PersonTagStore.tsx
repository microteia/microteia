import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { usePersonStore } from './usePersonStore';
import { makeGetPersonTagsUseCase } from '../domain/usecases/persontags/GetPersonTagsUseCase';
import { makeCreatePersonTagUseCase } from '../domain/usecases/persontags/CreatePersonTagUseCase';
import { makeUpdatePersonTagUseCase } from '../domain/usecases/persontags/UpdatePersonTagUseCase';
import { makeDeletePersonTagUseCase } from '../domain/usecases/persontags/DeletePersonTagUseCase';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { PersonTag, DeletionActor } from '../domain/entities';
import { PersonTagContext } from './usePersonTagStore';

export const PersonTagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { personTagRepository, personRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { updatePerson } = usePersonStore();

  const [tags, setTags] = useState<PersonTag[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    getTags:   makeGetPersonTagsUseCase(personTagRepository),
    createTag: makeCreatePersonTagUseCase(personTagRepository),
    updateTag: makeUpdatePersonTagUseCase(personTagRepository),
    deleteTag: makeDeletePersonTagUseCase(personTagRepository),
  }), [personTagRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    const list = await uc.getTags.execute(currentTenant.id);
    setTags(list);
  }, [currentTenant, uc]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta estado quando tenant é removido
    if (!currentTenant) { setTags([]); return; }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [currentTenant, refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.PERSON_TAG_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const getTagsForPerson = useCallback(
    (personId: string, tagIds: string[]): PersonTag[] => {
      void personId;
      return tags.filter((t) => tagIds.includes(t.id));
    },
    [tags],
  );

  const setTagsForPerson = useCallback(async (personId: string, tagIds: string[]) => {
    if (!currentTenant) return;
    await personRepository.updatePersonTags(currentTenant.id, personId, tagIds);
    await updatePerson(personId, { tagIds });
    storeEvents.emit(StoreEvents.PERSONS_UPDATED);
  }, [currentTenant, personRepository, updatePerson]);

  const createTag = useCallback(async (name: string, color: string): Promise<PersonTag> => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(currentTenant.id, { name, color, createdBy: user.id });
    storeEvents.emit(StoreEvents.PERSON_TAG_UPDATED);
    return tag;
  }, [currentTenant, user, uc]);

  const updateTag = useCallback(async (tagId: string, data: { name: string; color: string }) => {
    if (!currentTenant) return;
    const payload = {
      ...data,
      updatedBy: user?.id ?? '',
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    };
    await uc.updateTag.execute(currentTenant.id, tagId, payload);
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, ...payload } : t));
    storeEvents.emit(StoreEvents.PERSON_TAG_UPDATED);
  }, [currentTenant, user, effectiveName, uc]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.deleteTag.execute(currentTenant.id, tagId, actor);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    storeEvents.emit(StoreEvents.PERSON_TAG_UPDATED);
  }, [currentTenant, uc, user, effectiveName]);

  return (
    <PersonTagContext.Provider value={{ tags, loading, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag }}>
      {children}
    </PersonTagContext.Provider>
  );
};
