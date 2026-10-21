import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ScreenDefinitionContext } from './useScreenDefinitions';
import type { ScreenDefinitionSaveInput } from './useScreenDefinitions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetScreenDefinitionsUseCase } from '../domain/usecases/screendefinitions/GetScreenDefinitionsUseCase';
import { makeSaveScreenDefinitionUseCase } from '../domain/usecases/screendefinitions/SaveScreenDefinitionUseCase';
import { makeDeleteScreenDefinitionUseCase } from '../domain/usecases/screendefinitions/DeleteScreenDefinitionUseCase';
import { sortFieldsByOrder } from '../domain/services/customFieldValues';
import { isOwnedByParentScreen } from '../domain/services/screenDataCollection';
import { setRecordRulesScreens, toSchemaScreens } from '../data/utils/recordRulesGate';
import type { DeletionActor, FieldDefinition, ScreenDefinition } from '../domain/entities';

export const ScreenDefinitionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { screenDefinitionRepository, recordRepository } = useDI();

  const [definitions, setDefinitions] = useState<ScreenDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // De QUAL escritório são as telas em mãos. `isLoading` começa `false` e só vira `true` quando o
  // efeito roda: no primeiro render, "não carregando" com a lista vazia parecia "carregado e vazio".
  const [loadedTenantId, setLoadedTenantId] = useState<string | null>(null);

  const uc = useMemo(() => ({
    get: makeGetScreenDefinitionsUseCase(screenDefinitionRepository),
    save: makeSaveScreenDefinitionUseCase(screenDefinitionRepository),
    delete: makeDeleteScreenDefinitionUseCase(screenDefinitionRepository, recordRepository),
  }), [screenDefinitionRepository, recordRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setDefinitions(list);
      setLoadedTenantId(currentTenant.id);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

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
  // precisa listá-las para configuração. A tela apenas RELACIONADA a um pai continua no menu.
  const sidebarScreens = useMemo(
    () => dynamicScreens.filter((def) => !isOwnedByParentScreen(def) && !def.hideFromSidebar),
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

  return (
    <ScreenDefinitionContext.Provider value={{
      definitions,
      dynamicScreens,
      sidebarScreens,
      getDefinition,
      getScreenFieldsFor,
      isLoading,
      isLoaded: !!currentTenant && loadedTenantId === currentTenant.id,
      saveDefinition,
      deleteDefinition,
      refresh,
    }}>
      {children}
    </ScreenDefinitionContext.Provider>
  );
};
