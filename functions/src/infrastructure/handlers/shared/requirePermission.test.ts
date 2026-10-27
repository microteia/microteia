import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { isOfficeMember, requireAnyPermission, requireMemberSession, requirePermission } from './requirePermission';
import type { MemberMfaRequirement } from '../../../domain/schema/memberMfa';

const permissionsByUser: Record<string, string[]> = {};
const mfaByUser: Record<string, MemberMfaRequirement> = {};
const roleByUser: Record<string, string | null> = {};
const tenantOwner: { id: string | null } = { id: null };

vi.mock('../../di/container', () => ({
  getDI: () => ({
    getTenantMemberRepository: () => ({
      getMemberPermissions: async (_tenantId: string, userId: string) => permissionsByUser[userId] ?? [],
      getMemberAccess: async (_tenantId: string, userId: string) => (permissionsByUser[userId] || mfaByUser[userId]
        ? {
          userId,
          displayName: '',
          email: '',
          roleIds: [],
          permissions: permissionsByUser[userId] ?? [],
          mfa: mfaByUser[userId] ?? null,
        }
        : null),
    }),
    getUserRepository: () => ({
      getUserRole: async (userId: string) => roleByUser[userId] ?? null,
    }),
    getTenantRepository: () => ({
      getById: async () => (tenantOwner.id ? { ownerId: tenantOwner.id } : null),
    }),
  }),
}));



/** A sessão de quem chama: sem claim nenhuma, a não ser que o teste diga quando o fator foi provado. */
const caller = (uid: string, mfaAt?: number) => ({ uid, token: mfaAt === undefined ? {} : { mfaAt } });

const now = () => Math.floor(Date.now() / 1000);

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
    for (const key of Object.keys(mfaByUser)) delete mfaByUser[key];
    tenantOwner.id = null;
  });

  it('deixa passar quem tem a permissão, devolvendo o conjunto concedido', async () => {
    permissionsByUser.ana = ['automation.run'];
    await expect(requirePermission('t1', caller('ana'), 'automation.run')).resolves.toEqual(['automation.run']);
  });

  it('recusa quem não tem, dizendo qual permissão faltou', async () => {
    permissionsByUser.ana = ['automation.run'];
    const error = await denied(requirePermission('t1', caller('ana'), 'automation.manage'));
    expect(error.code).toBe('permission-denied');
    expect(error.message).toContain('@core.access/permission.denied');
  });

  it('recusa o membro sem nenhuma permissão materializada — a ausência não concede', async () => {
    const error = await denied(requirePermission('t1', caller('novo'), 'automation.run'));
    expect(error.code).toBe('permission-denied');
  });

  it('o curinga do DONO do escritório passa por qualquer permissão', async () => {
    permissionsByUser.dono = ['*'];
    await expect(requirePermission('t1', caller('dono'), 'automation.manage')).resolves.toEqual(['*']);
  });

  it('o administrador GLOBAL passa mesmo sem documento de membro', async () => {
    roleByUser.sys = 'SYSTEM';
    // Recebe o curinga: é o que ele de fato tem, e é o que vai para o ator da execução.
    await expect(requirePermission('t1', caller('sys'), 'automation.manage')).resolves.toEqual(['*']);
  });

  /**
   * O DONO passa mesmo SEM permissão materializada — é o caso em que ele mais precisa passar, porque
   * é o de um escritório que acabou de chegar ao modelo. Sem isto, as regras o deixavam entrar e a
   * callable o barrava: a mesma pergunta com duas respostas.
   */
  it('o DONO do escritório passa mesmo sem nada materializado', async () => {
    tenantOwner.id = 'dono';
    await expect(requirePermission('t1', caller('dono'), 'automation.manage')).resolves.toEqual(['*']);
  });

  it('quem não é o dono continua barrado', async () => {
    tenantOwner.id = 'outro';
    const error = await denied(requirePermission('t1', caller('ana'), 'automation.manage'));
    expect(error.code).toBe('permission-denied');
  });

  it('papel global comum NÃO passa por cima da permissão', async () => {
    roleByUser.ana = 'USER';
    const error = await denied(requirePermission('t1', caller('ana'), 'automation.manage'));
    expect(error.code).toBe('permission-denied');
  });
});

describe('requireAnyPermission', () => {
  beforeEach(() => {
    for (const key of Object.keys(permissionsByUser)) delete permissionsByUser[key];
    for (const key of Object.keys(roleByUser)) delete roleByUser[key];
    for (const key of Object.keys(mfaByUser)) delete mfaByUser[key];
    tenantOwner.id = null;
  });

  it('basta UMA das permissões', async () => {
    permissionsByUser.ana = ['automation.run'];
    await expect(
      requireAnyPermission('t1', caller('ana'), ['automation.manage', 'automation.run']),
    ).resolves.toBeUndefined();
  });

  it('o DONO do escritório passa em requireAnyPermission também', async () => {
    tenantOwner.id = 'dono';
    await expect(requireAnyPermission('t1', caller('dono'), ['a.read'])).resolves.toBeUndefined();
  });

  it('recusa quando não tem nenhuma, listando as que faltaram', async () => {
    const error = await denied(requireAnyPermission('t1', caller('ana'), ['a.read', 'b.read']));
    expect(error.code).toBe('permission-denied');
  });
});

describe('segundo fator exigido pelo escritório', () => {
  beforeEach(() => {
    for (const key of Object.keys(permissionsByUser)) delete permissionsByUser[key];
    for (const key of Object.keys(roleByUser)) delete roleByUser[key];
    for (const key of Object.keys(mfaByUser)) delete mfaByUser[key];
    tenantOwner.id = null;
  });

  it('o membro sem exigência passa como sempre, sem claim nenhuma', async () => {
    permissionsByUser.ana = ['automation.run'];
    await expect(requirePermission('t1', caller('ana'), 'automation.run')).resolves.toEqual(['automation.run']);
  });

  it('recusa a sessão que não provou o fator, dizendo o motivo — e não "falta permissão"', async () => {
    permissionsByUser.ana = ['automation.run'];
    mfaByUser.ana = { maxAgeSeconds: 3600 };
    const error = await denied(requirePermission('t1', caller('ana'), 'automation.run'));
    expect(error.code).toBe('permission-denied');
    expect(error.message).toBe('@core.access/mfa.session.missing');
    expect(error.details).toEqual({ secondFactor: 'missing' });
  });

  it('a prova recente passa; a vencida é recusada como vencida', async () => {
    permissionsByUser.ana = ['automation.run'];
    mfaByUser.ana = { maxAgeSeconds: 3600 };
    await expect(requirePermission('t1', caller('ana', now() - 60), 'automation.run')).resolves.toEqual(['automation.run']);
    const error = await denied(requirePermission('t1', caller('ana', now() - 3601), 'automation.run'));
    expect(error.message).toBe('@core.access/mfa.session.expired');
  });

  it('o DONO também é cobrado quando a política o alcança — o curinga não pula o fator', async () => {
    tenantOwner.id = 'dono';
    mfaByUser.dono = { maxAgeSeconds: 3600 };
    const error = await denied(requirePermission('t1', caller('dono'), 'automation.manage'));
    expect(error.message).toBe('@core.access/mfa.session.missing');
    await expect(requireAnyPermission('t1', caller('dono', now()), ['a.read'])).resolves.toBeUndefined();
  });

  it('o administrador GLOBAL não é alcançado pela política do escritório, como nas regras', async () => {
    roleByUser.sys = 'SYSTEM';
    permissionsByUser.sys = ['automation.run'];
    mfaByUser.sys = { maxAgeSeconds: 3600 };
    await expect(requirePermission('t1', caller('sys'), 'automation.run')).resolves.toEqual(['automation.run']);
  });

  it('a pergunta de pertencimento e a de sessão pura cobram o mesmo', async () => {
    permissionsByUser.ana = ['automation.run'];
    mfaByUser.ana = { maxAgeSeconds: 3600 };
    expect((await denied(isOfficeMember('t1', caller('ana')))).message).toBe('@core.access/mfa.session.missing');
    expect((await denied(requireMemberSession('t1', caller('ana')))).message).toBe('@core.access/mfa.session.missing');
    await expect(isOfficeMember('t1', caller('ana', now()))).resolves.toBe(true);
    await expect(requireMemberSession('t1', caller('quem-nao-e-membro'))).resolves.toBeUndefined();
  });
});
