import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * `tenants/{id}/extensions/{id}` — a origem `imported` não se desfaz. A extensão importada tem a
 * fonte com quem a escreveu: regravá-la como montada aqui seria editá-la por fora da tela.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const ID = 'com.acme.crm';
const pkg = { manifest: { id: ID, version: '1.0.0', kernel: '^2.0.0', name: 'CRM' }, summary: '', workflows: [] };

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { admin: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { admin: ['extensions.manage'] } },
    records: {
      [TENANT]: {
        [`extensions/${ID}`]: { package: pkg, origin: 'imported', active: false },
        'extensions/com.acme.mine': { package: pkg, origin: 'authored', active: false },
        'extensions/com.acme.legacy': { package: pkg, active: false },
      },
    },
  });
});

const ref = (id: string) => doc(asUser(env, 'admin'), `tenants/${TENANT}/extensions/${id}`);

describe('origem da extensão do escritório', () => {
  it('a importada não vira montada aqui', async () => {
    await assertFails(setDoc(ref(ID), { package: pkg, origin: 'authored', active: false }));
  });

  it('nem perde a origem', async () => {
    await assertFails(setDoc(ref(ID), { package: pkg, active: false }));
  });

  it('reimportar — a versão nova do autor — passa', async () => {
    await assertSucceeds(setDoc(ref(ID), { package: { ...pkg, manifest: { ...pkg.manifest, version: '1.1.0' } }, origin: 'imported', active: false }));
  });

  it('ligar e desligar não toca a origem', async () => {
    await assertSucceeds(updateDoc(ref(ID), { active: true }));
  });

  it('a montada aqui continua editável, e o documento antigo também', async () => {
    await assertSucceeds(setDoc(ref('com.acme.mine'), { package: pkg, origin: 'authored', active: true }));
    await assertSucceeds(setDoc(ref('com.acme.legacy'), { package: pkg, origin: 'authored', active: true }));
  });
});
