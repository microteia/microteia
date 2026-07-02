import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useFinancialStore } from './useFinancialStore';
import { makeGetFinancialTagsUseCase } from '../domain/usecases/financialtags/GetFinancialTagsUseCase';
import { makeCreateFinancialTagUseCase } from '../domain/usecases/financialtags/CreateFinancialTagUseCase';
import { makeUpdateFinancialTagUseCase } from '../domain/usecases/financialtags/UpdateFinancialTagUseCase';
import { makeDeleteFinancialTagUseCase } from '../domain/usecases/financialtags/DeleteFinancialTagUseCase';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { FinancialTag } from '../domain/entities';
import { FinancialTagContext } from './useFinancialTagStore';

export const FinancialTagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { financialTagRepository, financialRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { updateFinancial } = useFinancialStore();

  const [tags, setTags] = useState<FinancialTag[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    getTags:   makeGetFinancialTagsUseCase(financialTagRepository),
    createTag: makeCreateFinancialTagUseCase(financialTagRepository),
    updateTag: makeUpdateFinancialTagUseCase(financialTagRepository),
    deleteTag: makeDeleteFinancialTagUseCase(financialTagRepository),
  }), [financialTagRepository]);

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
    const unsub = storeEvents.on(StoreEvents.FINANCIAL_TAG_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const getTagsForFinancial = useCallback(
    (financialId: string, tagIds: string[]): FinancialTag[] => {
      void financialId;
      return tags.filter((t) => tagIds.includes(t.id));
    },
    [tags],
  );

  const setTagsForFinancial = useCallback(async (financialId: string, tagIds: string[]) => {
    if (!currentTenant) return;
    await financialRepository.updateFinancialTags(currentTenant.id, financialId, tagIds);
    await updateFinancial(financialId, { tagIds });
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, financialRepository, updateFinancial]);

  const createTag = useCallback(async (name: string, color: string): Promise<FinancialTag> => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(currentTenant.id, { name, color, createdBy: user.id });
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    storeEvents.emit(StoreEvents.FINANCIAL_TAG_UPDATED);
    return tag;
  }, [currentTenant, user, uc]);

  const updateTag = useCallback(async (tagId: string, data: { name: string; color: string }) => {
    if (!currentTenant) return;
    await uc.updateTag.execute(currentTenant.id, tagId, data);
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, ...data } : t));
    storeEvents.emit(StoreEvents.FINANCIAL_TAG_UPDATED);
  }, [currentTenant, uc]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!currentTenant) return;
    await uc.deleteTag.execute(currentTenant.id, tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    storeEvents.emit(StoreEvents.FINANCIAL_TAG_UPDATED);
  }, [currentTenant, uc]);

  return (
    <FinancialTagContext.Provider value={{ tags, loading, getTagsForFinancial, setTagsForFinancial, createTag, updateTag, deleteTag }}>
      {children}
    </FinancialTagContext.Provider>
  );
};
