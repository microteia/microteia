import { useMemo } from 'react';
import { deriveFormFields } from './deriveEntitySchema';
import { useSchemaContext } from './useSchemaContext';
import { useLabel } from './i18n/useT';
import type { EntityKey } from '../../domain/schema/entityRegistry';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

/**
 * A cópia da tela para EXIBIÇÃO: os títulos resolvidos, o resto intacto.
 *
 * Uma extensão lê `list.definition.titlePlural` para montar o cabeçalho da própria tela — é o gesto
 * óbvio, e era o errado: o título que ela declarou é uma referência, e o cabeçalho mostrava
 * `@com.microteia.news/screen.plural`. Exigir que cada autor lembrasse de chamar `useLabel` ali é
 * transferir para ele um cuidado que o host tem como cumprir uma vez — e que nós mesmos esquecemos.
 *
 * Resolver AQUI, e não no store, é o que mantém o Form Design editando o valor cru: quem edita a tela
 * lê do store, e gravar o texto resolvido por cima da referência congelaria a tradução no escritório.
 */
export const screenForDisplay = (
  definition: ScreenDefinition | null,
  label: (value: string | null | undefined) => string,
): ScreenDefinition | null => (definition === null ? null : {
  ...definition,
  titleSingular: label(definition.titleSingular),
  titlePlural: label(definition.titlePlural),
});

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
 * Resolve os rótulos de uma lista de campos JÁ MONTADA.
 *
 * Existe porque a resolução estava presa dentro de `useEntityFormFields`, e só o caminho da tela que
 * é VISÃO sobre outra coleção passava por lá. A tela que declara os próprios campos — que é o caso de
 * toda extensão — lia `definition.fields` cru, em quatro lugares, e o formulário nativo mostrava
 * `@com.microteia.news/field.title` na cara do usuário. O rótulo declarativo não é um detalhe do
 * caminho ligado: é a regra de qualquer campo.
 *
 * É IDEMPOTENTE de propósito — `resolveLabel` devolve texto comum intacto —, então aplicá-la depois do
 * ramo, sobre uma lista que já veio resolvida, é seguro. É o que permite UM ponto de resolução em vez
 * de dois ramos que precisam concordar.
 */
export const useResolvedFields = (fields: FieldDefinition[]): FieldDefinition[] => {
  const label = useLabel();
  return useMemo(
    () => fields.map((field) => ({
      ...field,
      label: label(field.label),
      placeholder: field.placeholder ? label(field.placeholder) : field.placeholder,
      section: field.section ? label(field.section) : field.section,
      options: field.options?.map((option) => ({ ...option, label: label(option.label) })),
    })),
    [fields, label],
  );
};

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
  const derived = useMemo(() => deriveFormFields(ctx, collection), [ctx, collection]);
  const fields = useResolvedFields(derived);

  const addedFields = useMemo(() => fields.filter((field) => field.origin !== 'builtin'), [fields]);

  return { fields, addedFields };
};
