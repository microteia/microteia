import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ScreenDefinitionContext, fieldOptionsKey } from './useScreenDefinitions';
import type { ScreenDefinitionSaveInput } from './useScreenDefinitions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetScreenDefinitionsUseCase } from '../domain/usecases/screendefinitions/GetScreenDefinitionsUseCase';
import { makeSaveScreenDefinitionUseCase } from '../domain/usecases/screendefinitions/SaveScreenDefinitionUseCase';
import { makeDeleteScreenDefinitionUseCase } from '../domain/usecases/screendefinitions/DeleteScreenDefinitionUseCase';
import { makeGetScreenFieldOptionsUseCase } from '../domain/usecases/screendefinitions/GetScreenFieldOptionsUseCase';
import { makeAddFieldOptionUseCase } from '../domain/usecases/screendefinitions/AddFieldOptionUseCase';
import { makeRemoveFieldOptionUseCase } from '../domain/usecases/screendefinitions/RemoveFieldOptionUseCase';
import { makeGetScreenTagsUseCase } from '../domain/usecases/screendefinitions/GetScreenTagsUseCase';
import { makeCreateScreenTagUseCase } from '../domain/usecases/screendefinitions/CreateScreenTagUseCase';
import { makeUpdateScreenTagUseCase } from '../domain/usecases/screendefinitions/UpdateScreenTagUseCase';
import { makeDeleteScreenTagUseCase } from '../domain/usecases/screendefinitions/DeleteScreenTagUseCase';
import { sortFieldsByOrder } from '../domain/services/customFieldValues';
import { setRecordRulesScreens, toSchemaScreens } from '../data/utils/recordRulesGate';
import type { ScreenTag, DeletionActor, FieldDefinition, ScreenDefinition, ScreenFieldOption } from '../domain/entities';

export const ScreenDefinitionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { screenDefinitionRepository, recordRepository } = useDI();

  const [definitions, setDefinitions] = useState<ScreenDefinition[]>([]);
  const [fieldOptionsByField, setFieldOptionsByField] = useState<Record<string, ScreenFieldOption[]>>({});
  const [tagsByScreen, setTagsByScreen] = useState<Record<string, ScreenTag[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetScreenDefinitionsUseCase(screenDefinitionRepository),
    save: makeSaveScreenDefinitionUseCase(screenDefinitionRepository),
    delete: makeDeleteScreenDefinitionUseCase(screenDefinitionRepository, recordRepository),
    getOptions: makeGetScreenFieldOptionsUseCase(screenDefinitionRepository),
    addOption: makeAddFieldOptionUseCase(screenDefinitionRepository),
    removeOption: makeRemoveFieldOptionUseCase(screenDefinitionRepository),
    getTags: makeGetScreenTagsUseCase(screenDefinitionRepository),
    createTag: makeCreateScreenTagUseCase(screenDefinitionRepository),
    updateTag: makeUpdateScreenTagUseCase(screenDefinitionRepository),
    deleteTag: makeDeleteScreenTagUseCase(screenDefinitionRepository),
  }), [screenDefinitionRepository, recordRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      const optionLists = await Promise.all(list.map((def) => uc.getOptions.execute(currentTenant.id, def.id)));
      const optionsMap: Record<string, ScreenFieldOption[]> = {};
      optionLists.flat().forEach((option) => {
        const mapKey = fieldOptionsKey(option.screenKey, option.fieldKey);
        optionsMap[mapKey] = [...(optionsMap[mapKey] ?? []), option];
      });
      const tagLists = await Promise.all(list.map((def) => uc.getTags.execute(currentTenant.id, def.id)));
      const tagsMap: Record<string, ScreenTag[]> = {};
      list.forEach((def, idx) => { tagsMap[def.id] = tagLists[idx]; });
      setDefinitions(list);
      setFieldOptionsByField(optionsMap);
      setTagsByScreen(tagsMap);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get, uc.getOptions, uc.getTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setRecordRulesScreens(toSchemaScreens(definitions));
  }, [definitions]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.SCREEN_DEFINITIONS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  // Telas que NÃO correspondem a uma entidade fixa: as do Form Design e as de extensão. São as que
  // ganham store genérico, menu automático e páginas genéricas — as fixas já têm as suas.
  const dynamicScreens = useMemo(
    () => definitions
      .filter((def) => def.origin !== 'builtin' && def.enabled)
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder),
    [definitions],
  );

  // Telas filhas existem só dentro do registro-pai: sem menu lateral e sem ⌘K. Elas seguem em
  // `dynamicScreens` porque o RecordStore precisa assinar seus registros e o ScreenBuilder
  // precisa listá-las para configuração.
  const sidebarScreens = useMemo(
    () => dynamicScreens.filter((def) => !def.parentEntity && !def.hideFromSidebar),
    [dynamicScreens],
  );

  const getDefinition = useCallback(
    (screenKey: string) => definitions.find((def) => def.id === screenKey),
    [definitions],
  );

  // Campos declarados pelo tenant para a entidade — os fixos vêm do ENTITY_REGISTRY e são
  // mesclados por `resolveScreenFields` na hora de montar o formulário.
  const getScreenFieldsFor = useCallback(
    (collection: string): FieldDefinition[] => {
      const def = definitions.find((d) => d.id === collection);
      return def ? sortFieldsByOrder(def.fields) : [];
    },
    [definitions],
  );

  const saveDefinition = useCallback(async (screenKey: string, data: ScreenDefinitionSaveInput) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const existing = definitions.find((def) => def.id === screenKey);
    const saved = await uc.save.execute(currentTenant.id, screenKey, {
      ...data,
      // Id universal da tela: gerado na criação (e retroativo na primeira edição de telas legadas),
      // preservado nas edições. É por ele que a instalação de extensões deduplica a mesma tela vinda
      // de pacotes diferentes.
      sourceId: data.sourceId ?? existing?.sourceId ?? crypto.randomUUID(),
      createdBy: user.id,
      updatedBy: user.id,
      updatedByName: effectiveName,
      updatedByPhotoURL: user.photoURL ?? '',
    });
    setDefinitions((prev) => {
      const exists = prev.some((def) => def.id === saved.id);
      return exists ? prev.map((def) => (def.id === saved.id ? saved : def)) : [...prev, saved];
    });
    storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
    return saved;
  }, [currentTenant, user, effectiveName, uc.save, definitions]);

  const deleteDefinition = useCallback(async (screenKey: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, screenKey, actor);
    setDefinitions((prev) => prev.filter((def) => def.id !== screenKey));
    storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  const addFieldOption = useCallback(async (screenKey: string, fieldKey: string, label: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const option = await uc.addOption.execute(currentTenant.id, screenKey, fieldKey, label, user.id);
    setFieldOptionsByField((prev) => {
      const mapKey = fieldOptionsKey(screenKey, fieldKey);
      const next = [...(prev[mapKey] ?? []), option].sort((a, b) => a.label.localeCompare(b.label));
      return { ...prev, [mapKey]: next };
    });
  }, [currentTenant, user, uc.addOption]);

  const removeFieldOption = useCallback(async (screenKey: string, fieldKey: string, optionKey: string) => {
    if (!currentTenant) return;
    const mapKey = fieldOptionsKey(screenKey, fieldKey);
    const option = (fieldOptionsByField[mapKey] ?? []).find((o) => o.key === optionKey);
    if (!option) return;
    await uc.removeOption.execute(currentTenant.id, screenKey, option.id);
    setFieldOptionsByField((prev) => ({
      ...prev,
      [mapKey]: (prev[mapKey] ?? []).filter((o) => o.id !== option.id),
    }));
  }, [currentTenant, uc.removeOption, fieldOptionsByField]);

  const createTag = useCallback(async (screenKey: string, name: string, color: string): Promise<ScreenTag> => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(currentTenant.id, screenKey, { name, color, createdBy: user.id });
    setTagsByScreen((prev) => ({
      ...prev,
      [screenKey]: [...(prev[screenKey] ?? []), tag].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return tag;
  }, [currentTenant, user, uc.createTag]);

  const updateTag = useCallback(async (screenKey: string, tagId: string, data: { name: string; color: string }) => {
    if (!currentTenant) return;
    await uc.updateTag.execute(currentTenant.id, screenKey, tagId, data);
    setTagsByScreen((prev) => ({
      ...prev,
      [screenKey]: (prev[screenKey] ?? [])
        .map((t) => (t.id === tagId ? { ...t, ...data } : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [currentTenant, uc.updateTag]);

  const deleteTag = useCallback(async (screenKey: string, tagId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.deleteTag.execute(currentTenant.id, screenKey, tagId, actor);
    setTagsByScreen((prev) => ({
      ...prev,
      [screenKey]: (prev[screenKey] ?? []).filter((t) => t.id !== tagId),
    }));
  }, [currentTenant, uc.deleteTag, user, effectiveName]);

  return (
    <ScreenDefinitionContext.Provider value={{
      definitions,
      dynamicScreens,
      sidebarScreens,
      getDefinition,
      getScreenFieldsFor,
      fieldOptionsByField,
      tagsByScreen,
      isLoading,
      saveDefinition,
      deleteDefinition,
      addFieldOption,
      removeFieldOption,
      createTag,
      updateTag,
      deleteTag,
      refresh,
    }}>
      {children}
    </ScreenDefinitionContext.Provider>
  );
};
