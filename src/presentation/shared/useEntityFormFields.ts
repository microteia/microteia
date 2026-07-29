import { useMemo } from 'react';
import { deriveFormFields } from './deriveEntitySchema';
import { useSchemaContext } from './useSchemaContext';
import type { EntityKey } from '../../domain/schema/entityRegistry';
import type { FieldDefinition } from '../../domain/entities';

export interface EntityFormFields {
  /** Todos os campos da tela, de qualquer origem, já ordenados. */
  fields: FieldDefinition[];
  /**
   * Os campos que NÃO vêm do kernel. As telas fixas mapeiam os seus campos nativos uma a um (tipos
   * próprios, conversão de data, endereço aninhado) e usam esta lista para o resto — que é gravado
   * na mesma raiz do documento, sem envelope.
   */
  addedFields: FieldDefinition[];
  /** Opções criadas pelo usuário são indexadas por tela — e a tela é a própria coleção. */
  resolveOptionsScreenKey: (field: FieldDefinition) => string;
}

/**
 * Campos do formulário de uma coleção. Substitui as constantes de módulo
 * (`PERSON_FORM_FIELDS = deriveFormFields('persons')`), que eram avaliadas uma vez no import e por
 * isso não enxergariam um ajuste salvo no Form Design sem recarregar a página.
 */
export const useEntityFormFields = (collection: EntityKey): EntityFormFields => {
  const ctx = useSchemaContext();

  const fields = useMemo(() => deriveFormFields(ctx, collection), [ctx, collection]);
  const addedFields = useMemo(() => fields.filter((field) => field.origin !== 'builtin'), [fields]);
  const resolveOptionsScreenKey = useMemo(() => () => collection, [collection]);

  return { fields, addedFields, resolveOptionsScreenKey };
};
