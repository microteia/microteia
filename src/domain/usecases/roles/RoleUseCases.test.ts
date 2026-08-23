import { describe, it, expect, vi } from 'vitest';
import type { PermissionCatalog } from '../../schema/access';
import { buildPermissionCatalog } from '../../schema/access';
import type { Role } from '../../entities/Role';
import type { IRoleRepository } from '../../repositories/IRoleRepository';
import { LocalizedError } from '../../errors/LocalizedError';
import {
  makeCreateRoleUseCase,
  makeDeleteRoleUseCase,
  makeUpdateRoleUseCase,
  validateRoleDraft,
} from './RoleUseCases';

const catalog = (): PermissionCatalog =>
  buildPermissionCatalog(
    [
      {
        source: 'com.acme.finance',
        permission: { id: 'finance.write', name: 'Edit', requires: ['finance.read', 'person.read'] },
      },
      { source: 'com.acme.finance', permission: { id: 'finance.read', name: 'View' } },
    ],
    [
      { id: 'finance', name: 'Finance', deriveCrud: true },
      { id: 'person', name: 'People', deriveCrud: true },
    ],
  );

const role = (over: Partial<Role> = {}): Role => ({
  id: 'r1',
  tenantId: 't1',
  name: 'Financeiro',
  description: null,
  permissions: ['finance.write'],
  system: false,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  updatedBy: 'u1',
  ...over,
});

const repo = (): IRoleRepository => ({
  getAll: vi.fn(),
  subscribeToRoles: vi.fn(),
  create: vi.fn(async (tenantId, data) => role({ tenantId, ...data })),
  update: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
  detachFromMembers: vi.fn(async () => undefined),
  syncPermissions: vi.fn(async () => 0),
});

const actor = { uid: 'u1' };

describe('validateRoleDraft', () => {
  it('aceita um perfil com permissões que resolvem', () => {
    expect(validateRoleDraft(catalog(), { name: 'Financeiro', permissions: ['finance.write'] })).toEqual([]);
  });

  it('recusa perfil sem nome', () => {
    const [diagnostic] = validateRoleDraft(catalog(), { name: '  ', permissions: [] });
    expect(diagnostic.message).toBe('@core.access/role.name.required');
  });

  it('recusa permissão que não existe no catálogo', () => {
    const [diagnostic] = validateRoleDraft(catalog(), { name: 'X', permissions: ['fantasma.read'] });
    expect(diagnostic.code).toBe('access.permission.unknown');
  });
});

describe('makeCreateRoleUseCase', () => {
  it('grava só as permissões EXPLÍCITAS, sem as dependências resolvidas', async () => {
    const repository = repo();
    await makeCreateRoleUseCase(repository).execute(
      't1',
      catalog(),
      { name: '  Financeiro  ', permissions: ['finance.write', 'finance.write'] },
      actor,
    );
    expect(repository.create).toHaveBeenCalledWith(
      't1',
      { name: 'Financeiro', description: null, permissions: ['finance.write'] },
      actor,
    );
  });

  it('recusa gravar um perfil inconsistente', async () => {
    const repository = repo();
    await expect(
      makeCreateRoleUseCase(repository).execute('t1', catalog(), { name: 'X', permissions: ['xpto.read'] }, actor),
    ).rejects.toBeInstanceOf(LocalizedError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe('makeUpdateRoleUseCase', () => {
  it('recusa alterar perfil protegido pelo sistema', async () => {
    const repository = repo();
    await expect(
      makeUpdateRoleUseCase(repository).execute(
        't1',
        role({ system: true }),
        catalog(),
        { name: 'Outro', permissions: [] },
        actor,
      ),
    ).rejects.toThrow('@core.access/role.system.protected');
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe('makeDeleteRoleUseCase', () => {
  it('tira o perfil dos membros ANTES de apagá-lo', async () => {
    const repository = repo();
    const order: string[] = [];
    repository.detachFromMembers = vi.fn(async () => { order.push('detach'); });
    repository.delete = vi.fn(async () => { order.push('delete'); });

    await makeDeleteRoleUseCase(repository).execute('t1', role());
    expect(order).toEqual(['detach', 'delete']);
  });

  it('recusa excluir perfil protegido pelo sistema', async () => {
    const repository = repo();
    await expect(makeDeleteRoleUseCase(repository).execute('t1', role({ system: true }))).rejects.toThrow(
      '@core.access/role.system.protected',
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
