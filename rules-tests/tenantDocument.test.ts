import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O documento do escritório. `accessUpgrades` (#29) diz quais atualizações de acesso o escritório já
 * recebeu, e é a única coisa que impede uma delas de rodar de novo — por isso só o servidor a grava.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { dono: {}, ana: {}, sys: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { dono: ['*'], ana: ['tenant.update'], sys: [] } },
  });
});

const tenant = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}`);

describe('o documento do escritório', () => {
  it('quem tem `tenant.update` altera os dados do escritório', async () => {
    await assertSucceeds(updateDoc(tenant('ana'), { name: 'Outro nome' }));
    await assertSucceeds(updateDoc(tenant('dono'), { name: 'Outro nome' }));
  });

  it('ninguém no navegador marca uma atualização de acesso como recebida — nem o dono', async () => {
    await assertFails(updateDoc(tenant('ana'), { accessUpgrades: arrayUnion('import-per-screen') }));
    await assertFails(updateDoc(tenant('dono'), { name: 'Outro', accessUpgrades: ['import-per-screen'] }));
  });

  it('nem o SYSTEM, que continua trocando o plano', async () => {
    await assertFails(updateDoc(tenant('sys'), { accessUpgrades: ['import-per-screen'] }));
    await assertSucceeds(updateDoc(tenant('sys'), { plan: 'starter' }));
  });
});
