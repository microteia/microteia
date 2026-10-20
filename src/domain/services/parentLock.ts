import type { FieldDefinition } from '../entities';
import { readValueByPath } from './customFieldValues';
import { isOwnedByParentScreen, type ScreenParentLinkSource } from './screenDataCollection';

/**
 * Um campo pelo qual uma lista se prende ao registro aberto. A declaração vem junto quando a tela a
 * tem — é dela que saem `multi` e `required`.
 */
export interface ParentLockField {
  key: string;
  field?: Partial<Pick<FieldDefinition, 'required' | 'multi'>>;
}

/**
 * O valor aponta para o pai: igualdade num vínculo único, *contém* numa lista. Decide pelo FORMATO do
 * valor gravado, e não pela declaração, para que o registro gravado antes de o campo virar `multi`
 * (ou o contrário) continue aparecendo onde aparecia.
 */
export const linkPointsTo = (value: unknown, recordId: string): boolean =>
  Array.isArray(value) ? value.includes(recordId) : value === recordId;

/** O registro entra na lista presa quando ALGUM dos campos aponta para o pai. */
export const pointsToParent = (record: object, fieldKeys: string[], recordId: string): boolean =>
  fieldKeys.some((key) => linkPointsTo(readValueByPath(record, key), recordId));

/** O valor com que o registro novo nasce preso ao pai — num `multi`, a lista de um id só. */
export const parentLinkValue = (
  field: Pick<FieldDefinition, 'multi'> | undefined,
  recordId: string,
): string | string[] => (field?.multi ? [recordId] : recordId);

/**
 * O que desvincular grava: tira o id das listas que o contêm e esvazia os campos únicos que apontam
 * para o pai. Campo que não aponta fica fora do patch — numa lista presa por vários campos, o polo
 * em que a pessoa não está não é tocado.
 */
export const unlinkFromParentPatch = (
  record: object,
  fieldKeys: string[],
  recordId: string,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  fieldKeys.forEach((key) => {
    const value = readValueByPath(record, key);
    if (Array.isArray(value)) {
      if (value.includes(recordId)) patch[key] = value.filter((id) => id !== recordId);
    } else if (value === recordId) {
      patch[key] = null;
    }
  });
  return patch;
};

/**
 * O vínculo não pode ser desfeito NESTE registro: algum campo que aponta para o pai é obrigatório e
 * ficaria vazio. Numa lista obrigatória com outros ids, tirar este é uma gravação que a validação
 * aceita — e por isso desvincular continua oferecido.
 */
export const parentLinkRequired = (record: object, lock: ParentLockField[], recordId: string): boolean =>
  lock.some(({ key, field }) => {
    const value = readValueByPath(record, key);
    if (!field?.required || !linkPointsTo(value, recordId)) return false;
    return !Array.isArray(value) || value.every((id) => id === recordId);
  });

/**
 * O que o registro é para o pai pelo qual a lista o prende — por registro, porque com vários campos
 * (ou com um `multi`) a resposta muda de um para outro. É posse quando o campo que aponta é a posse
 * declarada da tela, ou quando o vínculo é obrigatório e ficaria vazio (`parentLinkRequired`).
 *
 * Com um campo único, é exatamente o `parentLinkRelation` de sempre: todo registro da lista aponta
 * por ele, e um campo único que aponta sempre ficaria vazio.
 */
export const parentLockRelation = (
  screen: ScreenParentLinkSource,
  record: object,
  lock: ParentLockField[],
  recordId: string,
): 'owned' | 'related' => {
  const ownedByScreen = lock.some(({ key }) =>
    key === screen.parentFieldKey
    && isOwnedByParentScreen(screen)
    && linkPointsTo(readValueByPath(record, key), recordId));
  return ownedByScreen || parentLinkRequired(record, lock, recordId) ? 'owned' : 'related';
};
