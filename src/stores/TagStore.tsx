import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TagContext } from './useTags';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useDI } from '../infrastructure/di/useDI';
import {
  makeCreateTagUseCase,
  makeDeclareTagListUseCase,
  makeDeleteTagUseCase,
  makeSubscribeTagDefinitionsUseCase,
  makeSubscribeTagsUseCase,
  makeUpdateTagUseCase,
} from '../domain/usecases/tags';
import { ENTITY_REGISTRY_LIST } from '../domain/schema/entityRegistry';
import { setRecordRulesTagLists } from '../data/utils/recordRulesGate';
import { screenTagCollections } from '../domain/services/screenDataCollection';
import type { SchemaTagList } from '../domain/schema/screenEntity';
import type { Tag, TagDefinition } from '../domain/entities';

import { LocalizedError } from '../domain/errors/LocalizedError';
const BUILTIN_TAG_LISTS: SchemaTagList[] = ENTITY_REGISTRY_LIST
  .filter((entity) => !!entity.tagCollection)
  .map((entity) => ({
    collection: entity.tagCollection as string,
    label: `Etiquetas: ${entity.labelPlural}`,
  }));

const EMPTY_TAGS: Tag[] = [];

/**
 * Um store para TODAS as etiquetas. Substitui os 4 stores por entidade (`CaseTagStore` e irmãos) e
 * o caminho separado das telas dinâmicas, que guardava as etiquetas numa subcoleção de
 * `screenDefinitions` — e por isso as perdia junto com a tela. Aqui a chave é o nome da coleção, a
 * mesma que a tela declara em `tagCollection`, e é isso que permite duas telas compartilharem
 * as mesmas etiquetas.
 */
export const TagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName, effectivePhotoURL } = useAuth();
  const { definitions: screens } = useScreenDefinitions();
  const { tagRepository, tagDefinitionRepository } = useDI();

  const [tagsByCollection, setTagsByCollection] = useState<Record<string, Tag[]>>({});
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);

  const uc = useMemo(() => ({
    subscribeTags: makeSubscribeTagsUseCase(tagRepository),
    create: makeCreateTagUseCase(tagRepository),
    update: makeUpdateTagUseCase(tagRepository),
    remove: makeDeleteTagUseCase(tagRepository),
    subscribeDefinitions: makeSubscribeTagDefinitionsUseCase(tagDefinitionRepository),
    declare: makeDeclareTagListUseCase(tagDefinitionRepository),
  }), [tagRepository, tagDefinitionRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar o estado na troca de tenant é exigência arquitetural
      setDefinitions([]);
      return;
    }
    return uc.subscribeDefinitions.execute(currentTenant.id, setDefinitions);
  }, [currentTenant, uc.subscribeDefinitions]);

  const screenTagLists = useMemo<SchemaTagList[]>(() => screenTagCollections(screens), [screens]);

  const availableTagLists = useMemo<SchemaTagList[]>(
    () => {
      const byCollection = new Map<string, SchemaTagList>();
      for (const tagList of [
        ...BUILTIN_TAG_LISTS,
        ...screenTagLists,
        ...definitions.map((definition) => ({
          collection: definition.collection,
          label: definition.label,
        })),
      ]) {
        byCollection.set(tagList.collection, tagList);
      }
      return [...byCollection.values()];
    },
    [definitions, screenTagLists],
  );

  const subscribedCollections = useMemo(
    () => availableTagLists.map((tagList) => tagList.collection).join('\n'),
    [availableTagLists],
  );

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- idem
      setTagsByCollection({});
      return;
    }
    const collections = subscribedCollections.split('\n').filter(Boolean);
    const unsubscribes = collections.map((collection) =>
      uc.subscribeTags.execute(currentTenant.id, collection, (tags) => {
        setTagsByCollection((previous) => ({ ...previous, [collection]: tags }));
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, subscribedCollections, uc.subscribeTags]);

  useEffect(() => {
    setRecordRulesTagLists(availableTagLists);
  }, [availableTagLists]);

  /**
   * Pedir as etiquetas de uma coleção que ninguém assina é o sintoma de uma tela cuja
   * `tagCollection` não chegou até aqui — as etiquetas existem no banco e a tela mostra vazio. Sem
   * este aviso o caso é invisível: não há erro, só uma lista vazia.
   */
  const getTags = useCallback(
    (collection: string): Tag[] => {
      if (!collection) return EMPTY_TAGS;
      if (!(collection in tagsByCollection)) {
        console.warn(`[TagStore] "${collection}" não está entre as coleções assinadas:`, subscribedCollections.split('\n'));
        return EMPTY_TAGS;
      }
      return tagsByCollection[collection] ?? EMPTY_TAGS;
    },
    [tagsByCollection, subscribedCollections],
  );

  const createTag = useCallback(async (collection: string, name: string, color: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    // Coleção vazia significa tela sem `tagCollection` resolvido. Falhar aqui, com o motivo, evita
    // um caminho inválido no Firestore e o erro genérico que ele produz.
    if (!collection) {
      console.error('[TagStore] createTag sem coleção: a tela não resolveu `tagCollection`.');
      throw new LocalizedError('@core.records/screen.no-tags');
    }
    return uc.create.execute(currentTenant.id, collection, {
      name,
      color,
      createdBy: user.id,
      createdByName: effectiveName,
      createdByPhotoURL: effectivePhotoURL ?? undefined,
    });
  }, [currentTenant, user, effectiveName, effectivePhotoURL, uc.create]);

  const updateTag = useCallback(async (
    collection: string,
    tagId: string,
    data: { name: string; color: string },
  ) => {
    if (!currentTenant) throw new Error('No tenant');
    if (!collection) throw new LocalizedError('@core.records/screen.no-tags');
    await uc.update.execute(currentTenant.id, collection, tagId, data);
  }, [currentTenant, uc.update]);

  const deleteTag = useCallback(async (collection: string, tagId: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    if (!collection) throw new LocalizedError('@core.records/screen.no-tags');
    await uc.remove.execute(currentTenant.id, collection, tagId, {
      uid: user.id,
      name: effectiveName,
      photoURL: effectivePhotoURL ?? '',
    });
  }, [currentTenant, user, effectiveName, effectivePhotoURL, uc.remove]);

  const declareTagList = useCallback(async (collection: string, label: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    await uc.declare.execute(currentTenant.id, { collection, label, createdBy: user.id });
  }, [currentTenant, user, uc.declare]);

  const value = useMemo(() => ({
    tagsByCollection,
    definitions,
    availableTagLists,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    declareTagList,
  }), [tagsByCollection, definitions, availableTagLists, getTags, createTag, updateTag, deleteTag, declareTagList]);

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
};
