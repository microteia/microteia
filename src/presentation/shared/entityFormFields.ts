import type { FieldDefinition } from '../../domain/entities';

/**
 * Núcleo puro da lista unificada de campos do formulário (nativos + adicionais).
 *
 * O problema que esta função resolve: campos adicionais têm `order` próprio começando em 0, que
 * colidiria com o dos nativos. Enquanto o tenant nunca reordenou a lista unificada
 * (`orderUnified === false`), os adicionais são deslocados para depois do último nativo — que é
 * exatamente o layout de hoje, quando eram dois blocos separados. Depois da primeira reordenação
 * no Form Design, as duas famílias passam a gravar posições absolutas no mesmo espaço e o
 * deslocamento sai de cena, permitindo intercalar.
 */
export const mergeFormFields = (
  nativeFields: FieldDefinition[],
  customFields: FieldDefinition[],
  orderUnified: boolean,
): FieldDefinition[] => {
  if (orderUnified) {
    return [...nativeFields, ...customFields].sort((a, b) => a.order - b.order);
  }

  const maxNativeOrder = nativeFields.reduce((max, field) => Math.max(max, field.order), -1);
  const shifted = customFields.map((field) => ({
    ...field,
    order: maxNativeOrder + 1 + field.order,
  }));

  return [...nativeFields, ...shifted].sort((a, b) => a.order - b.order);
};

/**
 * As opções criadas pelo usuário são indexadas por tela + campo. Os campos nativos sempre usaram
 * uma chave própria (`persons-native`), e ela precisa continuar valendo depois da unificação —
 * senão as opções já cadastradas somem.
 */
export const nativeOptionsScreenKey = (entityKey: string): string => `${entityKey}-native`;

export const buildOptionsScreenKeyResolver = (
  entityKey: string,
  customFieldKeys: ReadonlySet<string>,
) => (field: FieldDefinition): string =>
  customFieldKeys.has(field.key) ? entityKey : nativeOptionsScreenKey(entityKey);
