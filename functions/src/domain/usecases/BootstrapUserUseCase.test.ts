import { describe, expect, it, vi } from 'vitest';
import { makeBootstrapUserUseCase } from './BootstrapUserUseCase';
import type { IUserRepository } from '../repositories/IUserRepository';
import type { CreateTenantInput, ITenantRepository } from '../repositories/ITenantRepository';
import { isArtifactPrefix } from '../schema/plugin/artifactPrefix';

const setup = (alreadyProvisioned = false) => {
  const created: CreateTenantInput[] = [];
  const users = {
    createUserIfMissing: vi.fn(async () => !alreadyProvisioned),
    createUserProfileIfMissing: vi.fn(async () => undefined),
  } as unknown as IUserRepository;
  const tenants = {
    createTenant: vi.fn(async (input: CreateTenantInput) => {
      created.push(input);
      return { id: 't1' };
    }),
    addMemberIfWithinLimit: vi.fn(async () => undefined),
  } as unknown as ITenantRepository;
  return { users, tenants, created };
};

const input = { userId: 'u1', email: 'ana@x.com', displayName: 'Ana', photoURL: null };

describe('BootstrapUserUseCase', () => {
  it('o escritório nasce com um prefixo sorteado, no formato', async () => {
    const { users, tenants, created } = setup();

    await makeBootstrapUserUseCase(users, tenants, () => 0).execute(input);

    expect(created[0].artifactPrefix).toBe('aaaa');
    expect(isArtifactPrefix(created[0].artifactPrefix)).toBe(true);
  });

  it('com o sorteio de verdade, o prefixo tem quatro letras minúsculas', async () => {
    const { users, tenants, created } = setup();

    await makeBootstrapUserUseCase(users, tenants).execute(input);

    expect(created[0].artifactPrefix).toMatch(/^[a-z]{4}$/);
  });

  it('usuário já provisionado não cria outro escritório', async () => {
    const { users, tenants, created } = setup(true);

    await makeBootstrapUserUseCase(users, tenants).execute(input);

    expect(created).toHaveLength(0);
  });
});
