import { describe, expect, it } from 'vitest';
import { portalExamplePlugin } from './examples/portal-example/plugin';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import {
  portalDeclarationIssues,
  portalTargetScreen,
  resolvePortalSubjectKeys,
  type PortalScreenLike,
} from '../../domain/schema/portal';

/**
 * O exemplo do portal COMO O ESCRITÓRIO O RECEBE: as telas materializadas, e a âncora que a instalação
 * grava com o nome da coleção de cada tela com `dataCollection` — sem campos e sem portal, e listada
 * antes, como sai do Firestore. É o par que fazia a Visita não chegar a ninguém.
 */
const installed = (): PortalScreenLike[] => {
  const screens = materializePluginScreens(portalExamplePlugin, 'u1').map(({ screenKey, input }) => ({
    id: screenKey,
    collection: input.dataCollection || screenKey,
    titleFieldKey: input.titleFieldKey,
    fields: input.fields,
    parentEntity: input.parentEntity,
    parentFieldKey: input.parentFieldKey,
    portal: input.portal ?? null,
  }));
  const anchors = screens
    .filter((screen) => screen.collection !== screen.id)
    .map((screen): PortalScreenLike => ({ id: screen.collection, collection: screen.collection, fields: [], portal: null }));
  return [...anchors, ...screens];
};

describe('portal-example — tela com dataCollection no meio da corrente', () => {
  it('a Visita chega ao Cliente pelo Local, atravessando a coleção que tem âncora', async () => {
    const screens = installed();
    const visit = screens.find((screen) => screen.id === 'portalExampleVisit')!;
    const records: Record<string, Record<string, unknown>> = {
      'portalExampleSites/s1': { name: 'Warehouse', client: 'acme' },
    };

    const keys = await resolvePortalSubjectKeys(visit, 'v1', { date: '2026-10-22', site: 's1' }, {
      screenFor: (entityKey) => portalTargetScreen(screens, entityKey),
      getRecord: async (collection, id) => records[`${collection}/${id}`],
    });
    expect(keys).toEqual(['portalExampleClient/acme']);
  });

  it('nenhuma tela do exemplo tem problema de declaração', () => {
    const screens = installed();
    for (const screen of screens.filter((one) => one.portal)) {
      expect(portalDeclarationIssues(screen, screens), screen.id).toEqual([]);
    }
  });
});
