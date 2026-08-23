import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { PermissionCatalog } from '../schema/access';
import { buildPermissionCatalog } from '../schema/access';
import type { PermissionCatalogCache } from '../../data/services/PermissionCatalogCache';
import { makeMaterializeMemberPermissionsUseCase } from './MaterializeMemberPermissionsUseCase';

type Doc = Record<string, unknown>;

interface FakeState {
  tenants: Record<string, Doc>;
  roles: Record<string, Record<string, Doc>>;
  members: Record<string, Record<string, Doc>>;
}

const fakeDb = (state: FakeState): Firestore => {
  const snapshot = (id: string, data: Doc | undefined, onUpdate: (patch: Doc) => void) => ({
    id,
    exists: data !== undefined,
    data: () => data,
    ref: { update: async (patch: Doc) => onUpdate(patch) },
  });

  return {
    doc: (path: string) => {
      const [, tenantId] = path.split('/');
      return { get: async () => snapshot(tenantId, state.tenants[tenantId], () => undefined) };
    },
    collection: (path: string) => {
      const [, tenantId, kind] = path.split('/');
      const bucket = (kind === 'roles' ? state.roles : state.members)[tenantId] ?? {};
      return {
        get: async () => ({
          docs: Object.entries(bucket).map(([id, data]) =>
            snapshot(id, data, (patch) => Object.assign(bucket[id], patch)),
          ),
        }),
      };
    },
  } as unknown as Firestore;
};

const catalog = (): PermissionCatalog =>
  buildPermissionCatalog(
    [
      {
        source: 'com.acme.finance',
        permission: { id: 'finance.write', name: 'Edit', requires: ['finance.read', 'person.read'] },
      },
    ],
    [
      { id: 'finance', name: 'Finance', deriveCrud: true },
      { id: 'person', name: 'People', deriveCrud: true },
    ],
  );

const cache = (): PermissionCatalogCache =>
  ({ get: async () => catalog(), invalidate: () => undefined }) as unknown as PermissionCatalogCache;

const baseState = (): FakeState => ({
  tenants: { t1: { ownerId: 'owner' }, t2: { ownerId: 'other-owner' } },
  roles: {
    t1: { 'r-fin': { permissions: ['finance.write'] } },
    t2: { 'r-outro': { permissions: ['person.delete'] } },
  },
  members: {
    t1: {
      owner: { userId: 'owner', roleIds: [] },
      ana: { userId: 'ana', roleIds: ['r-fin'] },
      bruno: { userId: 'bruno', roleIds: [] },
    },
    t2: { 'other-owner': { userId: 'other-owner', roleIds: [] } },
  },
});

const run = async (state: FakeState, tenantId = 't1', userIds?: string[]) =>
  makeMaterializeMemberPermissionsUseCase(fakeDb(state), cache()).execute({
    tenantId,
    ...(userIds ? { userIds } : {}),
  });

describe('MaterializeMemberPermissionsUseCase', () => {
  it('grava o fecho transitivo do perfil no documento do membro', async () => {
    const state = baseState();
    await run(state);
    expect(state.members.t1.ana.permissions).toEqual(['finance.read', 'finance.write', 'person.read']);
  });

  it('o DONO do escritório recebe o curinga, sem perfil nenhum', async () => {
    const state = baseState();
    await run(state);
    expect(state.members.t1.owner.permissions).toEqual(['*']);
  });

  it('membro sem perfil fica sem permissão nenhuma', async () => {
    const state = baseState();
    await run(state);
    expect(state.members.t1.bruno.permissions).toEqual([]);
  });

  it('é idempotente: a segunda passada não grava nada', async () => {
    const state = baseState();
    expect(await run(state)).toBe(3);
    expect(await run(state)).toBe(0);
  });

  it('quem RECEBE um perfil passa a ter o que ele dá', async () => {
    const state = baseState();
    await run(state);
    state.members.t1.bruno.roleIds = ['r-fin'];
    await run(state, 't1', ['bruno']);
    expect(state.members.t1.bruno.permissions).toEqual(['finance.read', 'finance.write', 'person.read']);
  });

  it('quem PERDE um perfil deixa de ter o que ele dava', async () => {
    const state = baseState();
    await run(state);
    state.members.t1.ana.roleIds = [];
    await run(state, 't1', ['ana']);
    expect(state.members.t1.ana.permissions).toEqual([]);
  });

  it('perfil de OUTRO escritório não concede nada', async () => {
    const state = baseState();
    state.members.t1.bruno.roleIds = ['r-outro'];
    await run(state);
    expect(state.members.t1.bruno.permissions).toEqual([]);
  });

  it('recalcular um escritório não toca nos membros do outro', async () => {
    const state = baseState();
    await run(state);
    expect(state.members.t2['other-owner'].permissions).toBeUndefined();
  });

  it('escritório inexistente não faz nada', async () => {
    const state = baseState();
    expect(await run(state, 'fantasma')).toBe(0);
  });
});
