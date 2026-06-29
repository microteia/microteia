import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useCaseStore } from './useCaseStore';
import { makeGetCaseTagsUseCase } from '../domain/usecases/casetags/GetCaseTagsUseCase';
import { makeCreateCaseTagUseCase } from '../domain/usecases/casetags/CreateCaseTagUseCase';
import { makeUpdateCaseTagUseCase } from '../domain/usecases/casetags/UpdateCaseTagUseCase';
import { makeDeleteCaseTagUseCase } from '../domain/usecases/casetags/DeleteCaseTagUseCase';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { CaseTag } from '../domain/entities';
import { CaseTagContext } from './useCaseTagStore';

export const CaseTagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { caseTagRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { updateCase } = useCaseStore();

  const [tags, setTags] = useState<CaseTag[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    getTags:   makeGetCaseTagsUseCase(caseTagRepository),
    createTag: makeCreateCaseTagUseCase(caseTagRepository),
    updateTag: makeUpdateCaseTagUseCase(caseTagRepository),
    deleteTag: makeDeleteCaseTagUseCase(caseTagRepository),
  }), [caseTagRepository]);

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
    const unsub = storeEvents.on(StoreEvents.CASE_TAG_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const getTagsForCase = useCallback(
    (_caseId: string, tagIds: string[]): CaseTag[] => tags.filter((t) => tagIds.includes(t.id)),
    [tags],
  );

  const setTagsForCase = useCallback(async (caseId: string, tagIds: string[]) => {
    await updateCase(caseId, { tagIds });
  }, [updateCase]);

  const createTag = useCallback(async (name: string, color: string): Promise<CaseTag> => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(currentTenant.id, { name, color, createdBy: user.id });
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    storeEvents.emit(StoreEvents.CASE_TAG_UPDATED);
    return tag;
  }, [currentTenant, user, uc]);

  const updateTag = useCallback(async (tagId: string, data: { name: string; color: string }) => {
    if (!currentTenant) return;
    await uc.updateTag.execute(currentTenant.id, tagId, data);
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, ...data } : t));
    storeEvents.emit(StoreEvents.CASE_TAG_UPDATED);
  }, [currentTenant, uc]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!currentTenant) return;
    await uc.deleteTag.execute(currentTenant.id, tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    storeEvents.emit(StoreEvents.CASE_TAG_UPDATED);
  }, [currentTenant, uc]);

  return (
    <CaseTagContext.Provider value={{ tags, loading, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag }}>
      {children}
    </CaseTagContext.Provider>
  );
};
