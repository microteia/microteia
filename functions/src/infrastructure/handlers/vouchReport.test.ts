import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaScreen } from '../../domain/schema/screenEntity';

const granted = new Set<string>();
const asked: string[] = [];
const check = (permission: string) => {
  asked.push(permission);
  if (!granted.has(permission)) throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission });
};
vi.mock('./shared/requirePermission', () => ({
  requirePermission: async (_t: string, _a: unknown, permission: string) => { check(permission); return [...granted]; },
  requireAllPermissions: async (_t: string, _a: unknown, permissions: string[]) => { permissions.forEach(check); return [...granted]; },
}));

const field = (key: string, type: string, order: number) => ({ key, label: key, type, required: false, order, origin: 'design' });
const schema = createSchemaContext([
  { id: 'funcionarios', titleSingular: 'Employee', titleFieldKey: 'depto', fields: [field('depto', 'text', 0), field('salario', 'number', 1)] },
  { id: 'vendas', titleSingular: 'Sale', titleFieldKey: 'vendedor', memberVisibility: { userFields: ['vendedor'] }, fields: [field('vendedor', 'text', 0), field('valor', 'number', 1)] },
] as unknown as SchemaScreen[], []);
vi.mock('../di/container', () => ({ getDI: () => ({ getScreenDefinitionCache: () => ({ getSchemaContext: async () => schema }) }) }));

let stored: Record<string, unknown> | undefined;
const writes: Record<string, unknown>[] = [];
vi.mock('../firebase/initFirebase', () => ({
  getDb: () => ({
    doc: (path: string) => ({ path }),
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }), doc: () => ({ get: async () => ({ exists: false }) }) }),
    runTransaction: async (fn: (transaction: unknown) => Promise<void>) => fn({
      get: async () => ({ exists: stored !== undefined, data: () => stored }),
      update: (_ref: unknown, data: Record<string, unknown>) => { writes.push(data); },
    }),
  }),
}));

import { vouchReport } from './vouchReport';

type Callable = { run: (request: unknown) => Promise<unknown> };
const call = () => (vouchReport as unknown as Callable).run({ data: { tenantId: 't1', reportId: 'r1' }, auth: { uid: 'rh', token: {} } });

const spec = (table: string, restricted = true) => ({
  version: 1,
  dataset: { table, dimensions: [{ key: 'g', path: table === 'vendas' ? 'vendedor' : 'depto' }], measures: [{ key: 't', op: 'sum', path: table === 'vendas' ? 'valor' : 'salario' }] },
  shape: { kind: 'summary', groupBy: [{ dimension: 'g' }] },
  ...(restricted ? { access: { restricted: true } } : {}),
});

describe('vouchReport — o aval do relatório restrito (#33)', () => {
  beforeEach(() => { granted.clear(); asked.length = 0; writes.length = 0; stored = undefined; });

  it('quem lê o que o relatório toca avaliza: o aval guarda quem e o spec conferido', async () => {
    stored = { spec: spec('funcionarios') };
    granted.add('reports.manage').add('funcionarios.read');
    await expect(call()).resolves.toEqual({ ok: true });
    expect(writes).toHaveLength(1);
    expect(writes[0].vouch).toMatchObject({ by: 'rh', spec: stored.spec });
  });

  it('quem não lê uma fonte é recusado, e nada é gravado', async () => {
    stored = { spec: spec('funcionarios') };
    granted.add('reports.manage');
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    expect(writes).toHaveLength(0);
  });

  it('sobre tela restrita por registro, ler não basta: é preciso ver todos', async () => {
    stored = { spec: spec('vendas') };
    granted.add('reports.manage').add('vendas.read');
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    granted.add('vendas.read-all');
    await expect(call()).resolves.toEqual({ ok: true });
  });

  it('o relatório de extensão é avalizado pela instalação, por quem tem extensions.manage', async () => {
    stored = { spec: spec('funcionarios'), ownerPluginId: 'com.acme.rh' };
    granted.add('extensions.manage');
    await expect(call()).resolves.toEqual({ ok: true });
    expect(asked).toEqual(['extensions.manage']);
    expect(writes[0].vouch).toMatchObject({ by: 'extension:com.acme.rh' });
  });

  it('relatório sem restrição não se avaliza', async () => {
    stored = { spec: spec('funcionarios', false) };
    granted.add('reports.manage').add('funcionarios.read');
    await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
