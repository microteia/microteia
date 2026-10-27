import { describe, expect, it, vi } from 'vitest';
import { makeCreateOrganizationUseCase } from './CreateOrganizationUseCase';
import type { StoredUser } from '../repositories/IUserRepository';
import type { CreateTenantInput, ITenantRepository } from '../repositories/ITenantRepository';
import { DomainError } from '../errors/DomainError';

const ACTOR = { userId: 'sys', userName: 'System', photoURL: '' };

const setup = (users: StoredUser[]) => {
  const created: CreateTenantInput[] = [];
  const tenants = {
    createTenant: vi.fn(async (input: CreateTenantInput) => { created.push(input); return { id: 'novo' }; }),
    addMemberIfWithinLimit: vi.fn(async () => undefined),
  } as unknown as ITenantRepository;
  const audit = { execute: vi.fn(async () => undefined) };
  const useCase = makeCreateOrganizationUseCase({
    users: { findByEmail: async (email) => users.find((user) => user.email === email) ?? null },
    tenants,
    audit,
    random: () => 0,
  });
  return { useCase, tenants, audit, created };
};

const refusal = async (promise: Promise<unknown>): Promise<DomainError> => {
  try { await promise; } catch (error) { return error as DomainError; }
  throw new Error('esperava recusa');
};

const ANA: StoredUser = { userId: 'ana', email: 'ana@x.com', displayName: 'Ana', photoURL: null, origin: 'invitation' };

describe('CreateOrganizationUseCase', () => {
  it('abre o escritório com a conta como dono, sem perfil, e registra na Auditoria do escritório novo', async () => {
    const { useCase, tenants, audit, created } = setup([ANA]);

    await expect(useCase.execute({ name: '  Prefeitura de X ', ownerEmail: 'ana@x.com', actor: ACTOR })).resolves.toEqual({ tenantId: 'novo' });

    expect(created[0]).toMatchObject({ name: 'Prefeitura de X', ownerId: 'ana', memberLimit: 1 });
    expect(tenants.addMemberIfWithinLimit).toHaveBeenCalledWith('novo', expect.objectContaining({ userId: 'ana', roleIds: [], addedBy: 'sys' }));
    expect(audit.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'novo', action: 'CREATE', textParams: { name: 'Prefeitura de X', owner: 'ana@x.com' } }));
  });

  it('recusa nome vazio, e dono sem conta', async () => {
    const { useCase, created } = setup([ANA]);
    expect((await refusal(useCase.execute({ name: ' ', ownerEmail: 'ana@x.com', actor: ACTOR }))).code).toBe('invalid-argument');
    expect((await refusal(useCase.execute({ name: 'X', ownerEmail: 'zeca@x.com', actor: ACTOR }))).code).toBe('not-found');
    expect(created).toHaveLength(0);
  });

  it('recusa o convidado do portal como dono', async () => {
    const { useCase } = setup([{ ...ANA, origin: 'portal' }]);
    expect((await refusal(useCase.execute({ name: 'X', ownerEmail: 'ana@x.com', actor: ACTOR }))).message)
      .toBe('@core.admin/access.offices.create.owner-portal');
  });
});
