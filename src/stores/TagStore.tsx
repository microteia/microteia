import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TagContext } from './useTags';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
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
import type { SchemaTagList } from '../domain/schema/screenEntity';
import type { Tag, TagDefinition } from '../domain/entities';

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

  const availableTagLists = useMemo<SchemaTagList[]>(
    () => [
      ...BUILTIN_TAG_LISTS,
      ...definitions.map((definition) => ({
        collection: definition.collection,
        label: definition.label,
      })),
    ],
    [definitions],
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

  const getTags = useCallback(
    (collection: string): Tag[] => tagsByCollection[collection] ?? EMPTY_TAGS,
    [tagsByCollection],
  );

  const createTag = useCallback(async (collection: string, name: string, color: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    // Coleção vazia significa tela sem `tagCollection` resolvido. Falhar aqui, com o motivo, evita
    // um caminho inválido no Firestore e o erro genérico que ele produz.
    if (!collection) throw new Error('A tela não tem um conjunto de etiquetas configurado.');
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
    if (!collection) throw new Error('A tela não tem um conjunto de etiquetas configurado.');
    await uc.update.execute(currentTenant.id, collection, tagId, data);
  }, [currentTenant, uc.update]);

  const deleteTag = useCallback(async (collection: string, tagId: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    if (!collection) throw new Error('A tela não tem um conjunto de etiquetas configurado.');
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
