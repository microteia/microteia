import type { FieldDefinition, ScreenDefinition } from '../entities';
import { collectionPermissionId } from '../schema/access/permission';
import type { ScreenCollectionSource } from '../schema/tenantCollections';
import { screenDataCollection } from '../schema/tenantCollections';

export type {
  DerivedCollection,
  ScreenCollectionDeclaration,
  ScreenCollectionSource,
  ScreenPresentationSource,
} from '../schema/tenantCollections';
export {
  isBoundScreen,
  presentedScreens,
  screenDataCollection,
  screenLookupCollections,
  screenTagCollections,
} from '../schema/tenantCollections';

/**
 * A permissão que ver esta tela EXIGE — a de ler a coleção dela, não a chave da tela.
 *
 * O menu e o ⌘K precisam da mesma frase que o catálogo derivou em `buildPermissionCatalog` e que o
 * `firestore.rules` cobra: uma tela vinculada (`dataCollection`) é vista por quem lê a coleção de
 * destino, e não por quem lê uma coleção com o nome da aba. Sem este ponto único, um menu podia
 * perguntar por uma permissão que o catálogo nunca emitiu — e ficar escondido para todo mundo.
 */
export const screenReadPermission = (screen: ScreenCollectionSource): string =>
  collectionPermissionId(screenDataCollection(screen), 'read');

export type ScreenParentSource = Pick<ScreenDefinition, 'parentEntity' | 'parentRelation'>;

/**
 * A tela é FILHA de outra — os registros dela pertencem ao pai. É o que a tira do menu lateral e da
 * busca ⌘K, esconde o campo de vínculo do formulário aberto de dentro do pai (`hiddenParentFieldKey`)
 * e faz o registro voltar para o pai ao salvar.
 *
 * Declarar `parentEntity` sozinho já não basta: com `parentRelation: 'related'` o pai apenas MOSTRA
 * os registros que apontam para ele, e a tela continua sendo uma entidade de topo. O ponto único
 * existe para que as quatro decisões acima nunca divirjam entre si.
 */
export const isOwnedByParentScreen = (screen: ScreenParentSource): boolean =>
  !!screen.parentEntity && (screen.parentRelation ?? 'owned') === 'owned';

export type ScreenParentLinkSource = ScreenParentSource & Pick<ScreenDefinition, 'parentFieldKey'>;

/**
 * O que o registro é para o pai pelo qual uma lista o prende. É posse quando o campo é a posse
 * declarada da tela — ou quando ele é OBRIGATÓRIO: um vínculo que não pode ser esvaziado não se
 * desfaz, e oferecer "desvincular" ali era oferecer uma gravação que a validação recusa. É a mesma
 * regra que `domain.relationship.unlink-requires-optional` cobra do modelo de domínio.
 */
export const parentLinkRelation = (
  screen: ScreenParentLinkSource,
  linkFieldKey: string,
  linkField: Pick<FieldDefinition, 'required'> | undefined,
): 'owned' | 'related' =>
  (linkFieldKey === screen.parentFieldKey && isOwnedByParentScreen(screen)) || !!linkField?.required
    ? 'owned'
    : 'related';

/**
 * O campo de posse que o formulário esconde — só quando o pai é CONHECIDO, isto é, quando a aba foi
 * aberta de dentro dele e o campo nasce preenchido. Aberto pela tela própria do filho (menu, ⌘K,
 * deep link, edição), o campo aparece como declarado: escondê-lo ali tornava impossível criar o
 * registro, porque o vínculo obrigatório ficava sem onde ser escolhido.
 */
export const hiddenParentFieldKey = (
  screen: ScreenParentLinkSource,
  parentContext: { fieldKey: string | null } | null,
): string | null => {
  if (!parentContext || !screen.parentFieldKey || !isOwnedByParentScreen(screen)) return null;
  const linkFieldKey = parentContext.fieldKey ?? screen.parentFieldKey;
  return linkFieldKey === screen.parentFieldKey ? screen.parentFieldKey : null;
};
