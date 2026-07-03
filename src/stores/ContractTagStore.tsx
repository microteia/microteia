import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useContractStore } from './useContractStore';
import { makeGetContractTagsUseCase } from '../domain/usecases/contracttags/GetContractTagsUseCase';
import { makeCreateContractTagUseCase } from '../domain/usecases/contracttags/CreateContractTagUseCase';
import { makeUpdateContractTagUseCase } from '../domain/usecases/contracttags/UpdateContractTagUseCase';
import { makeDeleteContractTagUseCase } from '../domain/usecases/contracttags/DeleteContractTagUseCase';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { ContractTag, DeletionActor } from '../domain/entities';
import { ContractTagContext } from './useContractTagStore';

export const ContractTagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { contractTagRepository, contractRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { updateContract } = useContractStore();

  const [tags, setTags] = useState<ContractTag[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    getTags:   makeGetContractTagsUseCase(contractTagRepository),
    createTag: makeCreateContractTagUseCase(contractTagRepository),
    updateTag: makeUpdateContractTagUseCase(contractTagRepository),
    deleteTag: makeDeleteContractTagUseCase(contractTagRepository),
  }), [contractTagRepository]);

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
    const unsub = storeEvents.on(StoreEvents.CONTRACT_TAG_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const getTagsForContract = useCallback(
    (contractId: string, tagIds: string[]): ContractTag[] => {
      void contractId;
      return tags.filter((t) => tagIds.includes(t.id));
    },
    [tags],
  );

  const setTagsForContract = useCallback(async (contractId: string, tagIds: string[]) => {
    if (!currentTenant) return;
    await contractRepository.updateContractTags(currentTenant.id, contractId, tagIds);
    await updateContract(contractId, { tagIds });
    storeEvents.emit(StoreEvents.CONTRACTS_UPDATED);
  }, [currentTenant, contractRepository, updateContract]);

  const createTag = useCallback(async (name: string, color: string): Promise<ContractTag> => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(currentTenant.id, { name, color, createdBy: user.id });
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    storeEvents.emit(StoreEvents.CONTRACT_TAG_UPDATED);
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
    storeEvents.emit(StoreEvents.CONTRACT_TAG_UPDATED);
  }, [currentTenant, user, effectiveName, uc]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.deleteTag.execute(currentTenant.id, tagId, actor);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    storeEvents.emit(StoreEvents.CONTRACT_TAG_UPDATED);
  }, [currentTenant, uc, user, effectiveName]);

  return (
    <ContractTagContext.Provider value={{ tags, loading, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag }}>
      {children}
    </ContractTagContext.Provider>
  );
};
