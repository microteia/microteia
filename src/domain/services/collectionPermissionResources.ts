import type { SchemaLookup } from '../schema/screenEntity';
import { RESERVED_COLLECTIONS } from '../schema/screenEntity';
import type { PermissionResource } from '../schema/access';

/**
 * As listas de opções e os conjuntos de etiquetas como RECURSOS do catálogo de permissões.
 *
 * Existe como ponto único por duas razões que já custaram caro separadas:
 *
 * 1. **O rótulo viaja com os parâmetros dele.** `SchemaLookup` guarda `label` e `labelParams`, e o
 *    mapeamento que ficava no store levava só o primeiro — `@core.data/lookup.qualified` chegava à
 *    tela de Perfis de acesso como o próprio template, sem nada para interpolar.
 * 2. **Coleção RESERVADA não deriva CRUD.** O `firestore.rules` só monta `<coleção>.create` no
 *    curinga, e o curinga exige `!isReservedCollection(name)`: uma reservada tem regra própria, com
 *    permissão própria — `documentTypes` é guardada por `document-types.manage`. Derivar as quatro
 *    para ela dava um grupo inteiro de permissões que nenhuma regra lê, ao lado do grupo verdadeiro.
 */
export const collectionPermissionResources = (
  ...groups: readonly SchemaLookup[][]
): PermissionResource[] =>
  groups
    .flat()
    .filter((collection) => !RESERVED_COLLECTIONS.has(collection.collection))
    .map((collection) => ({
      id: collection.collection,
      name: collection.label,
      ...(collection.labelParams ? { nameParams: collection.labelParams } : {}),
      deriveCrud: true,
    }));
