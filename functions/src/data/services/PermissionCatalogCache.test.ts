import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { PermissionCatalogCache } from './PermissionCatalogCache';

type Docs = Record<string, Record<string, unknown>>;

const fakeDb = (collections: Record<string, Docs>) => {
  const reads: string[] = [];
  const db = {
    collection: (path: string) => ({
      get: async () => {
        reads.push(path);
        const name = path.split('/').pop() as string;
        return {
          docs: Object.entries(collections[name] ?? {}).map(([id, data]) => ({ id, data: () => data })),
        };
      },
    }),
  } as unknown as Firestore;
  return { db, reads };
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

  it('`fresh` relê o banco mesmo com o cache válido', async () => {
    const { db, reads } = fakeDb({ screenDefinitions: TELA_COM_LISTA });
    const cache = new PermissionCatalogCache(db);

    await cache.get('t1');
    await cache.get('t1');
    const lidasComCache = reads.length;
    await cache.fresh('t1');

    expect(reads.length).toBe(lidasComCache * 2);
  });
});
