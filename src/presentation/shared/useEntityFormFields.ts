import { useMemo } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { deriveFormFields } from './deriveEntitySchema';
import { buildOptionsScreenKeyResolver, mergeFormFields } from './entityFormFields';
import type { EntityKey } from '../../domain/schema/entityRegistry';
import type { FieldDefinition } from '../../domain/entities';

export interface EntityFormFields {
  /** Fixos + adicionais, já com os ajustes do Form Design e ordenados. */
  fields: FieldDefinition[];
  /** Só os adicionais — as telas usam para separar `customValues` na gravação. */
  customFields: FieldDefinition[];
  resolveOptionsScreenKey: (field: FieldDefinition) => string;
}

/**
 * Lista de campos do formulário de uma tela FIXA. Substitui as constantes de módulo
 * (`PERSON_FORM_FIELDS = deriveFormFields('persons')`), que eram avaliadas uma vez no import e por
 * isso não enxergariam um ajuste salvo no Form Design sem recarregar a página.
 */
export const useEntityFormFields = (entityKey: EntityKey): EntityFormFields => {
  const { getDefinition, getCustomFieldsFor } = useScreenDefinitions();

  const definition = getDefinition(entityKey);
  const nativeOverrides = definition?.nativeFieldOverrides ?? null;
  const orderUnified = definition?.fieldOrderUnified === true;
  const customFields = useMemo(() => getCustomFieldsFor(entityKey), [getCustomFieldsFor, entityKey]);

  const fields = useMemo(
    () => mergeFormFields(deriveFormFields(entityKey, { nativeOverrides }), customFields, orderUnified),
    [entityKey, nativeOverrides, customFields, orderUnified],
  );

  const resolveOptionsScreenKey = useMemo(
    () => buildOptionsScreenKeyResolver(entityKey, new Set(customFields.map((field) => field.key))),
    [entityKey, customFields],
  );

  return { fields, customFields, resolveOptionsScreenKey };
};
