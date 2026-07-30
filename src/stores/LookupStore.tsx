import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LookupContext } from './useLookups';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import {
  makeAddLookupOptionUseCase,
  makeDeclareLookupUseCase,
  makeRemoveLookupOptionUseCase,
  makeSubscribeLookupDefinitionsUseCase,
  makeSubscribeLookupOptionsUseCase,
} from '../domain/usecases/lookups';
import { LOOKUP_REGISTRY_LIST } from '../domain/schema/lookupRegistry';
import { setRecordRulesLookups } from '../data/utils/recordRulesGate';
import type { SchemaLookup } from '../domain/schema/screenEntity';
import type { LookupDefinition, LookupOption } from '../domain/entities';

const BUILTIN_LOOKUPS: SchemaLookup[] = LOOKUP_REGISTRY_LIST.map((lookup) => ({
  collection: lookup.collection,
  label: `${lookup.screenLabel}: ${lookup.entityLabel}`,
}));

const EMPTY_OPTIONS: LookupOption[] = [];

/**
 * Um store para TODAS as listas de opções. Substitui os 7 stores por entidade (`CaseLookupStore` e
 * irmãos), que replicavam a mesma assinatura por coleção com nomes de campo diferentes
 * (`areaConfigs`, `courtConfigs`…). Aqui a chave é o nome da coleção — a mesma que o campo declara
 * em `lookupCollection` —, e por isso a lista do kernel e a criada no Form Design saem pelo mesmo
 * caminho.
 */
export const LookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { lookupRepository, lookupDefinitionRepository } = useDI();

  const [optionsByCollection, setOptionsByCollection] = useState<Record<string, LookupOption[]>>({});
  const [definitions, setDefinitions] = useState<LookupDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribeOptions: makeSubscribeLookupOptionsUseCase(lookupRepository),
    addOption: makeAddLookupOptionUseCase(lookupRepository),
    removeOption: makeRemoveLookupOptionUseCase(lookupRepository),
    subscribeDefinitions: makeSubscribeLookupDefinitionsUseCase(lookupDefinitionRepository),
    declare: makeDeclareLookupUseCase(lookupDefinitionRepository),
  }), [lookupRepository, lookupDefinitionRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar o estado na troca de tenant é exigência arquitetural
      setDefinitions([]);
      return;
    }
    return uc.subscribeDefinitions.execute(currentTenant.id, setDefinitions);
  }, [currentTenant, uc.subscribeDefinitions]);

  const availableLookups = useMemo<SchemaLookup[]>(
    () => [
      ...BUILTIN_LOOKUPS,
      ...definitions.map((definition) => ({
        collection: definition.collection,
        label: definition.label,
      })),
    ],
    [definitions],
  );

  const subscribedCollections = useMemo(
    () => availableLookups.map((lookup) => lookup.collection).join('\n'),
    [availableLookups],
  );

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- idem
      setOptionsByCollection({});
      return;
    }
    setLoading(true);
    const collections = subscribedCollections.split('\n').filter(Boolean);
    const unsubscribes = collections.map((collection) =>
      uc.subscribeOptions.execute(currentTenant.id, collection, (options) => {
        setOptionsByCollection((previous) => ({ ...previous, [collection]: options }));
        setLoading(false);
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, subscribedCollections, uc.subscribeOptions]);

  /**
   * Os repositórios não alcançam um Store React, e a camada de regras precisa saber quais listas
   * existem para validar uma gravação de automação. Mesmo mecanismo que o `ScreenDefinitionStore`
   * usa para empurrar as telas.
   */
  useEffect(() => {
    setRecordRulesLookups(availableLookups);
  }, [availableLookups]);

  const getOptions = useCallback(
    (collection: string): LookupOption[] => optionsByCollection[collection] ?? EMPTY_OPTIONS,
    [optionsByCollection],
  );

  const addOption = useCallback(async (collection: string, label: string, color?: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const trimmed = label.trim();
    if (!trimmed) return;
    await uc.addOption.execute(currentTenant.id, collection, { key: trimmed, label: trimmed, color }, user.id);
  }, [currentTenant, user, uc.addOption]);

  const removeOption = useCallback(async (collection: string, key: string) => {
    if (!currentTenant) throw new Error('No tenant');
    await uc.removeOption.execute(currentTenant.id, collection, key);
  }, [currentTenant, uc.removeOption]);

  const declareLookup = useCallback(async (collection: string, label: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    await uc.declare.execute(currentTenant.id, {
      collection,
      label,
      createdBy: user.id,
    });
  }, [currentTenant, user, uc.declare]);

  const value = useMemo(() => ({
    optionsByCollection,
    definitions,
    availableLookups,
    loading,
    getOptions,
    addOption,
    removeOption,
    declareLookup,
  }), [optionsByCollection, definitions, availableLookups, loading, getOptions, addOption, removeOption, declareLookup]);

  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
};
