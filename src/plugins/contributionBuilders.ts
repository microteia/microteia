import React, { lazy } from 'react';

/**
 * O que sobrou aqui depois de os construtores irem para o SDK (`src/sdk/contributions.ts`): a carga
 * preguiçosa de uma tela do bundle. Ela não pode viajar no SDK porque `impl: { kind: 'code' }` só se
 * resolve por chave no `ImplementationRegistry` do bundle — é privilégio de plugin interno, e o
 * `lazy` do React não teria sentido para quem entrega a view como fonte.
 */
export type PageComponent = React.ComponentType<{ tabKey: string }>;

/**
 * Carrega a tela sob demanda. Um manifest precisa poder ser lido sem arrastar o código da tela
 * junto — com centenas de plugins instalados, importar tudo no boot inviabilizaria o bundle.
 */
export const lazyView = (
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
): PageComponent =>
  lazy(async () => ({ default: (await loader())[exportName] as PageComponent }));

export {
  authProvider,
  command,
  menuItem,
  nav,
  navGroup,
  page,
  pointContribution,
  recordAction,
  settingsSection,
  surfaceSlot,
  surfaceSlotSpec,
  surfaceTab,
  surfaceTabSpec,
  surfaceWidget,
  surfaceWidgetSpec,
  widgetPage,
} from '../sdk/contributions';
