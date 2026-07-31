import { useCallback, useMemo } from 'react';
import { useTags } from '../../../stores/useTags';
import { useSchemaContext } from '../useSchemaContext';
import { resolveEntity } from '../../../domain/schema/screenEntity';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import type { Tag } from '../../../domain/entities';

/**
 * A coleção de etiquetas de uma tela. `declared` é o que a PRÓPRIA tela declara — é ele que manda,
 * porque é a tela que está sendo exibida; sem ele, a resposta vem da entidade da coleção, que é
 * como duas telas passam a compartilhar as mesmas etiquetas. Vazio = a tela não tem etiquetas.
 *
 * A precedência importa: a entidade só existe enquanto alguma tela a descreve, e uma tela recém
 * instalada já sabe as próprias etiquetas antes de qualquer outra coisa estar no lugar.
 */
export const useTagCollection = (entityCollection: string, declared?: string | null): string => {
  const ctx = useSchemaContext();
  return useMemo(
    () => declared?.trim() || resolveEntity(ctx, entityCollection)?.tagCollection || '',
    [ctx, entityCollection, declared],
  );
};

/**
 * Monta o `TagStoreAdapter` que o `TagManager` consome, para QUALQUER tela. Substitui os cinco
 * blocos quase idênticos que cada ViewModel montava a partir do seu store tipado: o que muda entre
 * eles é só a coleção e como o registro guarda os `tagIds`.
 */
export const useTagAdapter = (
  entityCollection: string,
  tagIdsOf: (entityId: string) => string[],
  setRecordTags: (entityId: string, tagIds: string[]) => Promise<void> | void,
  declaredCollection?: string | null,
): TagStoreAdapter => {
  const collection = useTagCollection(entityCollection, declaredCollection);
  const { getTags, createTag, updateTag, deleteTag } = useTags();

  const tags = getTags(collection);

  const getAppliedTags = useCallback(
    (entityId: string): Tag[] => {
      const applied = tagIdsOf(entityId);
      return tags.filter((tag) => applied.includes(tag.id));
    },
    [tags, tagIdsOf],
  );

  return useMemo(() => ({
    tags,
    getAppliedTags,
    setTags: setRecordTags,
    createTag: (name: string, color: string) => createTag(collection, name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(collection, id, data),
    deleteTag: (id: string) => deleteTag(collection, id),
  }), [tags, getAppliedTags, setRecordTags, collection, createTag, updateTag, deleteTag]);
};
