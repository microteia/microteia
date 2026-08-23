import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { requireAnyPermission, requirePermission } from './requirePermission';

const permissionsByUser: Record<string, string[]> = {};
const roleByUser: Record<string, string | null> = {};

vi.mock('../../di/container', () => ({
  getDI: () => ({
    getTenantMemberRepository: () => ({
      getMemberPermissions: async (_tenantId: string, userId: string) => permissionsByUser[userId] ?? [],
    }),
    getUserRepository: () => ({
      getUserRole: async (userId: string) => roleByUser[userId] ?? null,
    }),
  }),
}));



const denied = async (promise: Promise<unknown>): Promise<HttpsError> => {
  try {
    await promise;
  } catch (error) {
    return error as HttpsError;
  }
  throw new Error('esperava recusa, e a chamada passou');
};

describe('requirePermission', () => {
  beforeEach(() => {
    for (const key of Object.keys(permissionsByUser)) delete permissionsByUser[key];
    for (const key of Object.keys(roleByUser)) delete roleByUser[key];
  });

  it('deixa passar quem tem a permissão, devolvendo o conjunto concedido', async () => {
    permissionsByUser.ana = ['automation.run'];
    await expect(requirePermission('t1', 'ana', 'automation.run')).resolves.toEqual(['automation.run']);
  });

  it('recusa quem não tem, dizendo qual permissão faltou', async () => {
    permissionsByUser.ana = ['automation.run'];
    const error = await denied(requirePermission('t1', 'ana', 'automation.manage'));
    expect(error.code).toBe('permission-denied');
    expect(error.message).toContain('@core.access/permission.denied');
  });

  it('recusa o membro sem nenhuma permissão materializada — a ausência não concede', async () => {
    const error = await denied(requirePermission('t1', 'novo', 'automation.run'));
    expect(error.code).toBe('permission-denied');
  });

  it('o curinga do DONO do escritório passa por qualquer permissão', async () => {
    permissionsByUser.dono = ['*'];
    await expect(requirePermission('t1', 'dono', 'automation.manage')).resolves.toEqual(['*']);
  });

  it('o administrador GLOBAL passa mesmo sem documento de membro', async () => {
    roleByUser.sys = 'SYSTEM';
    // Recebe o curinga: é o que ele de fato tem, e é o que vai para o ator da execução.
    await expect(requirePermission('t1', 'sys', 'automation.manage')).resolves.toEqual(['*']);
  });

  it('papel global comum NÃO passa por cima da permissão', async () => {
    roleByUser.ana = 'USER';
    const error = await denied(requirePermission('t1', 'ana', 'automation.manage'));
    expect(error.code).toBe('permission-denied');
  });
});

describe('requireAnyPermission', () => {
  beforeEach(() => {
    for (const key of Object.keys(permissionsByUser)) delete permissionsByUser[key];
    for (const key of Object.keys(roleByUser)) delete roleByUser[key];
  });

  it('basta UMA das permissões', async () => {
    permissionsByUser.ana = ['automation.run'];
    await expect(
      requireAnyPermission('t1', 'ana', ['automation.manage', 'automation.run']),
    ).resolves.toBeUndefined();
  });

  it('recusa quando não tem nenhuma, listando as que faltaram', async () => {
    const error = await denied(requireAnyPermission('t1', 'ana', ['a.read', 'b.read']));
    expect(error.code).toBe('permission-denied');
  });
});
