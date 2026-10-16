import type { ScreenDefinition } from '../entities';
import { screenDataCollection } from './screenDataCollection';

type TabScreen = Pick<
  ScreenDefinition,
  'id' | 'sourceId' | 'dataCollection' | 'parentEntity' | 'parentFieldKey' | 'hideFromParentTabs'
>;

export const CHILD_TAB_PREFIX = 'child:';

/**
 * A identidade de uma tela entre escritórios: o `sourceId`, ou a chave quando a tela é anterior a
 * ele. É por ela que uma superfície de registro (`record:<sourceId>`) é endereçada.
 */
export const screenSourceIdOf = (screen: Pick<ScreenDefinition, 'id' | 'sourceId'>): string =>
  screen.sourceId ?? screen.id;

/**
 * A chave da aba de uma tela-filha — a mesma no detalhe e na configuração que a liga, desliga e
 * ordena. Sai do `sourceId` da filha, e não da chave instalada, pelo mesmo motivo do endereço da
 * superfície: a configuração gravada tem de continuar valendo depois de uma reinstalação.
 */
export const childTabKey = (screen: Pick<ScreenDefinition, 'id' | 'sourceId'>): string =>
  `${CHILD_TAB_PREFIX}${screenSourceIdOf(screen)}`;

/**
 * As telas que viram aba no detalhe de um registro da coleção `parentCollection`. Quem a Form Design
 * da FILHA tirou do pai (`hideFromParentTabs`) não entra — e por isso nem aparece em Configurações:
 * a configuração escolhe entre o que a estrutura da tela oferece, nunca o contrário.
 */
export const childTabScreens = <T extends TabScreen>(screens: T[], parentCollection: string): T[] =>
  screens.filter(
    (screen) => screen.parentEntity === parentCollection && !!screen.parentFieldKey && !screen.hideFromParentTabs,
  );

/** Os `sourceId` das telas que têm ao menos uma aba de tela-filha no detalhe. */
export const screensWithChildTabs = <T extends TabScreen>(screens: T[]): string[] =>
  screens
    .filter((parent) => childTabScreens(screens, screenDataCollection(parent)).length > 0)
    .map(screenSourceIdOf);
