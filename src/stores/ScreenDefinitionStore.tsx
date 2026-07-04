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
import { sortFieldsByOrder } from '../domain/services/customFieldValues';
import type { DeletionActor, FieldDefinition, ScreenDefinition, ScreenFieldOption } from '../domain/entities';

export const ScreenDefinitionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { screenDefinitionRepository, customRecordRepository } = useDI();

  const [definitions, setDefinitions] = useState<ScreenDefinition[]>([]);
  const [fieldOptionsByField, setFieldOptionsByField] = useState<Record<string, ScreenFieldOption[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetScreenDefinitionsUseCase(screenDefinitionRepository),
    save: makeSaveScreenDefinitionUseCase(screenDefinitionRepository),
    delete: makeDeleteScreenDefinitionUseCase(screenDefinitionRepository, customRecordRepository),
    getOptions: makeGetScreenFieldOptionsUseCase(screenDefinitionRepository),
    addOption: makeAddFieldOptionUseCase(screenDefinitionRepository),
    removeOption: makeRemoveFieldOptionUseCase(screenDefinitionRepository),
  }), [screenDefinitionRepository, customRecordRepository]);

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
      setDefinitions(list);
      setFieldOptionsByField(optionsMap);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get, uc.getOptions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.SCREEN_DEFINITIONS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const dynamicScreens = useMemo(
    () => definitions
      .filter((def) => !def.builtin && def.enabled)
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder),
    [definitions],
  );

  const getDefinition = useCallback(
    (screenKey: string) => definitions.find((def) => def.id === screenKey),
    [definitions],
  );

  const getCustomFieldsFor = useCallback(
    (entityKey: string): FieldDefinition[] => {
      const def = definitions.find((d) => d.id === entityKey && d.builtin);
      return def ? sortFieldsByOrder(def.fields) : [];
    },
    [definitions],
  );

  const saveDefinition = useCallback(async (screenKey: string, data: ScreenDefinitionSaveInput) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const saved = await uc.save.execute(currentTenant.id, screenKey, {
      ...data,
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
  }, [currentTenant, user, effectiveName, uc.save]);

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

  return (
    <ScreenDefinitionContext.Provider value={{
      definitions,
      dynamicScreens,
      getDefinition,
      getCustomFieldsFor,
      fieldOptionsByField,
      isLoading,
      saveDefinition,
      deleteDefinition,
      addFieldOption,
      removeFieldOption,
      refresh,
    }}>
      {children}
    </ScreenDefinitionContext.Provider>
  );
};
