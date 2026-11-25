import { describe, it, expect } from 'vitest';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { PermissionCatalog } from '../schema/access';
import {
  ACCESS_UPGRADES,
  ACCESS_UPGRADE_AUTHOR,
  KERNEL_PERMISSIONS,
  KERNEL_PERMISSION_RESOURCES,
  PERMISSION_RECORD_IMPORT_RUN,
  buildPermissionCatalog,
} from '../schema/access';
import type { PermissionCatalogCache } from '../../data/services/PermissionCatalogCache';
import type { CreateAuditLogInput } from './CreateAuditLogUseCase';
import { makeApplyAccessUpgradesUseCase } from './ApplyAccessUpgradesUseCase';

type Doc = Record<string, unknown>;

interface FakeState {
  tenant?: Doc;
  roles: Record<string, Doc>;
}

/**
 * O suficiente do Admin SDK para a transação: o documento do escritório e a coleção de perfis. A marca
 * chega como `arrayUnion`, que o fake aplica comparando com o valor esperado — é o que o Firestore faria.
 */
const fakeDb = (state: FakeState) => {
  const writes: { path: string; patch: Doc }[] = [];
  const tenantRef = { path: 'tenants/t1' };
  const snapshotOf = (path: string, data: Doc | undefined, ref: unknown) => ({
    id: path.split('/').pop(),
    exists: data !== undefined,
    data: () => data,
    ref,
  });
  const roleRefs = () => Object.keys(state.roles).map((id) => ({ path: `tenants/t1/roles/${id}`, id }));
  const apply = (ref: { path: string }, patch: Doc) => {
    writes.push({ path: ref.path, patch });
    if (ref.path === tenantRef.path && state.tenant) {
      const union = patch.accessUpgrades as FieldValue;
      if (union.isEqual(FieldValue.arrayUnion(...ACCESS_UPGRADES))) state.tenant.accessUpgrades = [...ACCESS_UPGRADES];
      return;
    }
    const id = ref.path.split('/').pop() as string;
    state.roles[id] = { ...state.roles[id], ...patch };
  };
  const db = {
    doc: () => ({ ...tenantRef, get: async () => snapshotOf(tenantRef.path, state.tenant, tenantRef) }),
    collection: () => ({ path: 'tenants/t1/roles' }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({
      get: async (ref: { path: string }) => (ref.path === tenantRef.path
        ? snapshotOf(ref.path, state.tenant, tenantRef)
        : { docs: roleRefs().map((role) => snapshotOf(role.path, state.roles[role.id], role)) }),
      update: (ref: { path: string }, patch: Doc) => apply(ref, patch),
    }),
  } as unknown as Firestore;
  return { db, writes };
};

const catalog = (): PermissionCatalog => buildPermissionCatalog(
  KERNEL_PERMISSIONS.map((permission) => ({ permission, source: 'core.access' })),
  [
    ...KERNEL_PERMISSION_RESOURCES,
    { id: 'precos', name: 'Preços', deriveCrud: true, deriveImport: true },
    { id: 'estoque', name: 'Estoque', deriveCrud: true, deriveImport: true },
  ],
);

const setup = (state: FakeState) => {
  const { db, writes } = fakeDb(state);
  const audit: CreateAuditLogInput[] = [];
  const cache = { fresh: async () => catalog() } as unknown as PermissionCatalogCache;
  const useCase = makeApplyAccessUpgradesUseCase(db, cache, { execute: async (input) => { audit.push(input); } });
  return { useCase, writes, audit };
};

const compras = (): Doc => ({
  permissions: [PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'estoque.update'],
  updatedBy: 'admin',
});

describe('a atualização de acesso aplicada ao escritório', () => {
  it('o escritório de antes recebe a permissão por tela, é marcado e a Auditoria diz por quê', async () => {
    const state: FakeState = {
      tenant: { ownerId: 'dono' },
      roles: { compras: compras(), leitura: { permissions: ['precos.read'] } },
    };
    const { useCase, audit } = setup(state);

    expect(await useCase.execute('t1')).toBe(1);
    expect(state.roles.compras).toMatchObject({
      permissions: [PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'estoque.update', 'estoque.import', 'precos.import'],
      updatedBy: ACCESS_UPGRADE_AUTHOR,
    });
    expect(state.roles.leitura).toEqual({ permissions: ['precos.read'] });
    expect(state.tenant?.accessUpgrades).toEqual([...ACCESS_UPGRADES]);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'SYSTEM',
      entity: 'roles',
      text: '@core.access/upgrade.audit.text',
      textParams: { roles: '1' },
    });
  });

  it('roda UMA vez: a permissão que o administrador tirou depois não volta', async () => {
    const state: FakeState = { tenant: { ownerId: 'dono' }, roles: { compras: compras() } };
    const { useCase, writes, audit } = setup(state);
    await useCase.execute('t1');
    state.roles.compras.permissions = [PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'estoque.update'];
    writes.length = 0;

    expect(await useCase.execute('t1')).toBe(0);
    expect(writes).toEqual([]);
    expect(audit).toHaveLength(1);
  });

  it('o escritório que nasceu marcado não tem perfil tocado', async () => {
    const state: FakeState = {
      tenant: { ownerId: 'dono', accessUpgrades: [...ACCESS_UPGRADES] },
      roles: { compras: compras() },
    };
    const { useCase, writes } = setup(state);

    expect(await useCase.execute('t1')).toBe(0);
    expect(writes).toEqual([]);
  });

  it('sem perfil a mudar, só a marca é gravada — e a Auditoria fica calada', async () => {
    const state: FakeState = { tenant: { ownerId: 'dono' }, roles: { leitura: { permissions: ['precos.read'] } } };
    const { useCase, writes, audit } = setup(state);

    expect(await useCase.execute('t1')).toBe(0);
    expect(writes.map((write) => write.path)).toEqual(['tenants/t1']);
    expect(audit).toEqual([]);
  });

  it('escritório que não existe não grava nada', async () => {
    const { useCase, writes } = setup({ roles: { compras: compras() } });
    expect(await useCase.execute('t1')).toBe(0);
    expect(writes).toEqual([]);
  });
});
