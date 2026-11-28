import { afterEach, describe, it, expect, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { PermissionCatalogCache } from './PermissionCatalogCache';

type Docs = Record<string, Record<string, unknown>>;

const valueAt = (data: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined), data);

const fakeDb = (collections: Record<string, Docs>) => {
  const reads: string[] = [];
  const stamp = { revision: 1 };
  const snapshotOf = (path: string, keep: (data: Record<string, unknown>) => boolean) => async () => {
    reads.push(path);
    const name = path.split('/').pop() as string;
    return {
      docs: Object.entries(collections[name] ?? {})
        .filter(([, data]) => keep(data))
        .map(([id, data]) => ({ id, data: () => data })),
    };
  };
  const db = {
    collection: (path: string) => ({
      get: snapshotOf(path, () => true),
      where: (field: string, _op: string, value: unknown) => ({ get: snapshotOf(path, (data) => valueAt(data, field) === value) }),
    }),
    doc: () => ({ get: async () => ({ exists: true, get: () => stamp.revision }) }),
  } as unknown as Firestore;
  return { db, reads, stamp };
};

const TELA_COM_LISTA = {
  consultas: {
    origin: 'design',
    titleSingular: 'Consultation',
    titlePlural: 'Consultations',
    tagCollection: 'consultas_tags',
    fields: [{ key: 'specialty', label: 'Specialty', type: 'select', lookupCollection: 'especialidades' }],
  },
};

describe('PermissionCatalogCache', () => {
  it('conhece a lista e as etiquetas que só a tela declara — as mesmas que o seletor oferece', async () => {
    const { db } = fakeDb({ screenDefinitions: TELA_COM_LISTA });

    const catalogo = await new PermissionCatalogCache(db).get('t1');

    expect(catalogo.byId.has('consultas.read')).toBe(true);
    expect(catalogo.byId.has('especialidades.read')).toBe(true);
    expect(catalogo.byId.has('consultas_tags.create')).toBe(true);
  });

  it('cada porta restrita gera a própria permissão; a que não é restrita não gera nada (#33)', async () => {
    const { db } = fakeDb({
      workflow_definitions: {
        wfA: { name: 'Adjust salary', access: { restricted: true } },
        wfB: { name: 'Issue receipt' },
        wfC: { name: 'From extension', sourceId: 'src1', access: { restricted: true } },
      },
      reports: {
        repA: { title: 'Payroll', spec: { access: { restricted: true } } },
        repB: { title: 'Mine', ownerId: 'u1', spec: { access: { restricted: true } } },
        repC: { title: 'Sales', spec: {} },
      },
    });

    const catalogo = await new PermissionCatalogCache(db).get('t1');

    expect(catalogo.byId.get('workflow-wfA.run')?.requires).toEqual(['automation.run']);
    expect(catalogo.byId.has('workflow-wfB.run')).toBe(false);
    expect(catalogo.byId.has('workflow-src1.run')).toBe(true);
    expect(catalogo.byId.has('report-repA.view')).toBe(true);
    expect(catalogo.byId.has('report-repB.view')).toBe(false);
    expect(catalogo.byId.has('report-repC.view')).toBe(false);
    expect(catalogo.resourceLabels.get('workflow-wfA')).toEqual({ name: '@core.access/resource.workflow', nameParams: { name: 'Adjust salary' } });
  });

  it('`fresh` relê o banco mesmo com o cache válido', async () => {
    const { db, reads } = fakeDb({ screenDefinitions: TELA_COM_LISTA });
    const cache = new PermissionCatalogCache(db);

    await cache.get('t1');
    await cache.get('t1');
    const lidasComCache = reads.length;
    await cache.fresh('t1');

    expect(reads.length).toBe(lidasComCache * 2);
  });

  describe('a tela criada em outra instância (#58)', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('carimbo novo: a permissão da coleção recém-criada entra no catálogo em segundos, não em minutos', async () => {
      vi.useFakeTimers();
      const screens: Docs = { ...TELA_COM_LISTA };
      const { db, stamp } = fakeDb({ screenDefinitions: screens });
      const cache = new PermissionCatalogCache(db, 300_000, 5_000);
      expect((await cache.get('t1')).byId.has('lancamentos.create')).toBe(false);

      screens.lancamentos = { origin: 'design', titleSingular: 'Entry', titlePlural: 'Entries', fields: [] };
      stamp.revision = 2;
      vi.advanceTimersByTime(6_000);

      expect((await cache.get('t1')).byId.has('lancamentos.create')).toBe(true);
    });

    it('carimbo igual: mantém o catálogo sem reler as seis fontes', async () => {
      vi.useFakeTimers();
      const { db, reads } = fakeDb({ screenDefinitions: TELA_COM_LISTA });
      const cache = new PermissionCatalogCache(db, 300_000, 5_000);
      await cache.get('t1');
      const lidas = reads.length;
      vi.advanceTimersByTime(6_000);
      await cache.get('t1');
      expect(reads.length).toBe(lidas);
    });
  });
});
