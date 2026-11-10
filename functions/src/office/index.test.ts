import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { requireInstalledExtension } from './index';
import type { MemberMfaRequirement } from '../domain/schema/memberMfa';

/**
 * A superfície PÚBLICA, ligada às leituras de verdade — só o Firestore e o DI são trocados.
 *
 * `installationGate.test.ts` prova onde cada recusa entra no portão, com os leitores injetados. Aqui se
 * prova a outra metade: que a permissão cobrada por uma extensão é decidida pela MESMA regra de
 * `requirePermission`, e não por uma releitura do documento de membro. Foi essa releitura, copiada numa
 * extensão, que recusava o `SYSTEM` em escritório alheio e deixava passar a sessão sem o segundo fator.
 */

const PLUGIN = 'com.acme.crm';

const permissionsByUser: Record<string, string[]> = {};
const mfaByUser: Record<string, MemberMfaRequirement> = {};
const roleByUser: Record<string, string> = {};
const ownerByTenant: Record<string, string> = {};
const installations: Record<string, { active?: boolean }> = {};
const installationReads: string[] = [];

vi.mock('../infrastructure/di/container', () => ({
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
      getUserRole: async (userId: string) => roleByUser[userId] ?? 'USER',
    }),
    getTenantRepository: () => ({
      getById: async (tenantId: string) => (ownerByTenant[tenantId] ? { ownerId: ownerByTenant[tenantId] } : null),
    }),
  }),
}));

vi.mock('../infrastructure/firebase/initFirebase', () => ({
  getDb: () => ({
    doc: (path: string) => ({
      get: async () => {
        installationReads.push(path);
        const data = installations[path];
        return { exists: data !== undefined, get: (field: string) => (data as Record<string, unknown> | undefined)?.[field] };
      },
    }),
  }),
}));

/**
 * O portão guarda a resposta da instalação por um minuto, por escritório. Cada caso usa o próprio
 * escritório para que a resposta de um não vaze para o seguinte.
 */
let office = 0;
const nextOffice = (installation: { active?: boolean } | null = { active: true }): string => {
  office += 1;
  const tenantId = `escritorio-${office}`;
  if (installation) installations[`tenants/${tenantId}/installed_extensions/${PLUGIN}`] = installation;
  return tenantId;
};

const request = (uid: string, mfaAt?: number) => ({ auth: { uid, token: mfaAt === undefined ? {} : { mfaAt } } });

const nowSeconds = () => Math.floor(Date.now() / 1000);

const denied = async (promise: Promise<unknown>): Promise<HttpsError> => {
  try {
    await promise;
  } catch (error) {
    return error as HttpsError;
  }
  throw new Error('esperava recusa, e a chamada passou');
};

const APPROVE = { permission: 'invoices.approve' };

describe('requireInstalledExtension com permissão, contra a regra de verdade', () => {
  beforeEach(() => {
    for (const map of [permissionsByUser, mfaByUser, roleByUser, ownerByTenant]) {
      for (const key of Object.keys(map)) delete map[key];
    }
    installationReads.length = 0;
  });

  it('deixa passar o membro que tem a permissão, devolvendo o uid', async () => {
    permissionsByUser.ana = ['invoices.read', 'invoices.approve'];
    await expect(requireInstalledExtension(PLUGIN, nextOffice(), request('ana'), APPROVE)).resolves.toBe('ana');
  });

  it('recusa o membro sem ela com permission-denied, nomeando a permissão', async () => {
    permissionsByUser.ana = ['invoices.read'];
    const error = await denied(requireInstalledExtension(PLUGIN, nextOffice(), request('ana'), APPROVE));

    expect(error.code).toBe('permission-denied');
    expect(error.message).toBe('@core.access/permission.denied');
    expect(error.details).toEqual({ permission: 'invoices.approve' });
  });

  /** O dono não pode depender de a materialização já ter rodado — as regras o deixam passar sem ela. */
  it('deixa passar o dono do escritório sem conjunto materializado', async () => {
    const tenantId = nextOffice();
    ownerByTenant[tenantId] = 'dono';
    await expect(requireInstalledExtension(PLUGIN, tenantId, request('dono'), APPROVE)).resolves.toBe('dono');
  });

  /**
   * O defeito que motivou a opção: o `SYSTEM` não tem documento de membro no escritório de outro dono, e
   * a cópia da regra na extensão o recusava com 403.
   */
  it('deixa passar o administrador global que não é membro do escritório', async () => {
    roleByUser.sys = 'SYSTEM';
    await expect(requireInstalledExtension(PLUGIN, nextOffice(), request('sys'), APPROVE)).resolves.toBe('sys');
  });

  it('recusa o membro com a permissão cuja sessão não provou o segundo fator exigido', async () => {
    permissionsByUser.ana = ['invoices.approve'];
    mfaByUser.ana = { maxAgeSeconds: 3600 };

    const missing = await denied(requireInstalledExtension(PLUGIN, nextOffice(), request('ana'), APPROVE));
    expect(missing.code).toBe('permission-denied');
    expect(missing.message).toBe('@core.access/mfa.session.missing');

    const expired = await denied(
      requireInstalledExtension(PLUGIN, nextOffice(), request('ana', nowSeconds() - 3601), APPROVE),
    );
    expect(expired.message).toBe('@core.access/mfa.session.expired');

    await expect(
      requireInstalledExtension(PLUGIN, nextOffice(), request('ana', nowSeconds()), APPROVE),
    ).resolves.toBe('ana');
  });

  it('recusa quem tem a permissão onde a extensão está desativada', async () => {
    permissionsByUser.ana = ['invoices.approve'];
    const error = await denied(
      requireInstalledExtension(PLUGIN, nextOffice({ active: false }), request('ana'), APPROVE),
    );

    expect(error.code).toBe('failed-precondition');
    expect(error.message).toBe('@core.marketplace/extension.not-installed');
  });

  it('recusa quem tem a permissão onde a extensão nunca foi instalada', async () => {
    permissionsByUser.ana = ['invoices.approve'];
    const error = await denied(requireInstalledExtension(PLUGIN, nextOffice(null), request('ana'), APPROVE));
    expect(error.code).toBe('failed-precondition');
  });

  /** Não se diz a um estranho se a extensão está instalada naquele escritório. */
  it('recusa o estranho sem ler a instalação', async () => {
    const error = await denied(requireInstalledExtension(PLUGIN, nextOffice(), request('estranho'), APPROVE));

    expect(error.code).toBe('permission-denied');
    expect(installationReads).toEqual([]);
  });

  it('sem a opção, continua cobrando só o pertencimento — o SYSTEM incluído', async () => {
    permissionsByUser.ana = ['invoices.read'];
    roleByUser.sys = 'SYSTEM';
    const tenantId = nextOffice();

    await expect(requireInstalledExtension(PLUGIN, tenantId, request('ana'))).resolves.toBe('ana');
    await expect(requireInstalledExtension(PLUGIN, tenantId, request('sys'))).resolves.toBe('sys');
    expect((await denied(requireInstalledExtension(PLUGIN, tenantId, request('estranho')))).message)
      .toBe('@core.access/office.not-member');
  });
});
