import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O PREFIXO do escritório mora em `settings/tenant`, ao lado das preferências, mas não é uma delas:
 * mudá-lo cobra `tenant.change-prefix` além de `settings.manage`, e o valor novo tem de estar no
 * formato. Quem só configura o escritório continua gravando o resto do documento — desde que leve o
 * prefixo como está.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { configura: {}, prefixa: {}, membro: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        configura: ['settings.manage'],
        prefixa: ['settings.manage', 'tenant.change-prefix'],
        membro: [],
      },
    },
    records: {
      [TENANT]: {
        'settings/tenant': { scope: 'tenant', values: { 'customization.prefix': 'abcd', 'downloads.retentionDays': 7 } },
      },
    },
  });
});

const settings = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/settings/tenant`);

const values = (prefix: unknown, retention = 7) => ({
  scope: 'tenant',
  values: { 'customization.prefix': prefix, 'downloads.retentionDays': retention },
});

describe('prefixo do escritório', () => {
  it('quem só configura grava o resto, levando o prefixo como está', async () => {
    await assertSucceeds(setDoc(settings('configura'), values('abcd', 30)));
  });

  it('quem só configura não troca o prefixo', async () => {
    await assertFails(setDoc(settings('configura'), values('wxyz')));
  });

  it('quem só configura não apaga o documento que guarda o prefixo', async () => {
    await assertFails(deleteDoc(settings('configura')));
  });

  it('quem tem a permissão troca o prefixo, no formato', async () => {
    await assertSucceeds(setDoc(settings('prefixa'), values('wxyz')));
  });

  it('o formato é cobrado: maiúscula, número no começo e tamanho fora da faixa são recusa', async () => {
    await assertFails(setDoc(settings('prefixa'), values('ABCD')));
    await assertFails(setDoc(settings('prefixa'), values('1abc')));
    await assertFails(setDoc(settings('prefixa'), values('a')));
    await assertFails(setDoc(settings('prefixa'), values('abcdefghi')));
  });

  it('o dono do escritório troca sem perfil nenhum', async () => {
    await assertSucceeds(setDoc(settings('dono'), values('dono')));
  });

  it('membro sem permissão não grava nada', async () => {
    await assertFails(setDoc(settings('membro'), values('abcd', 30)));
  });
});
