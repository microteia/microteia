import { useMemo } from 'react';
import { deriveFormFields } from './deriveEntitySchema';
import { useSchemaContext } from './useSchemaContext';
import { useLabel } from './i18n/useT';
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
}

/**
 * Campos do formulário de uma coleção. Substitui as constantes de módulo
 * (`PERSON_FORM_FIELDS = deriveFormFields('persons')`), que eram avaliadas uma vez no import e por
 * isso não enxergariam um ajuste salvo no Form Design sem recarregar a página.
 *
 * Os rótulos saem daqui RESOLVIDOS. O campo declarado em código traz uma referência
 * (`@core.tenant/office.name`), o campo que o escritório criou traz o texto que ele digitou, e a
 * mesma função atende os dois — é a regra de `resolveLabel`. Resolver aqui, e não em cada
 * `{field.label}` da View, é o que faz a busca e a ordenação casarem com o texto que se lê.
 */
export const useEntityFormFields = (collection: EntityKey): EntityFormFields => {
  const ctx = useSchemaContext();
  const label = useLabel();

  const fields = useMemo(
    () => deriveFormFields(ctx, collection).map((field) => ({
      ...field,
      label: label(field.label),
      placeholder: field.placeholder ? label(field.placeholder) : field.placeholder,
      section: field.section ? label(field.section) : field.section,
      options: field.options?.map((option) => ({ ...option, label: label(option.label) })),
    })),
    [ctx, collection, label],
  );

  const addedFields = useMemo(() => fields.filter((field) => field.origin !== 'builtin'), [fields]);

  return { fields, addedFields };
};
