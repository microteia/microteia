import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * A reputação de uma extensão — instalações, estrelas e publicador verificado.
 *
 * O que estas regras protegem é o NÚMERO: um contador que o autor consegue gravar não informa nada a
 * quem decide instalar. Por isso o agregado só sai do Admin SDK, o voto é um por pessoa e só de quem
 * tem a extensão instalada, e o selo de verificado só o SYSTEM concede.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const PLUGIN = 'com.acme.crm';

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, deFora: {}, sistema: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { membro: ['clientes.read'] },
      [OTHER_TENANT]: { deFora: ['extensions.manage'] },
    },
    records: { [TENANT]: { [`installed_extensions/${PLUGIN}`]: { source: 'public', active: true } } },
    root: { [`extension_stats/${PLUGIN}`]: { installs: 1, ratingCount: 0, ratingSum: 0 } },
  });
});

const vote = (uid: string) => doc(asUser(env, uid), `extension_stats/${PLUGIN}/ratings/${uid}`);
const ballot = (over: Record<string, unknown> = {}) => ({
  stars: 5,
  tenantId: TENANT,
  updatedAt: serverTimestamp(),
  ...over,
});

describe('agregado', () => {
  it('todo autenticado lê — é o que a tela de Extensões mostra', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'deFora'), `extension_stats/${PLUGIN}`)));
  });

  it('quem não entrou não lê', async () => {
    await assertFails(getDoc(doc(asAnonymous(env), `extension_stats/${PLUGIN}`)));
  });

  it('nenhum cliente escreve o número, nem o SYSTEM', async () => {
    await assertFails(setDoc(doc(asUser(env, 'sistema'), `extension_stats/${PLUGIN}`), { installs: 1000 }));
    await assertFails(setDoc(doc(asUser(env, 'membro'), `extension_stats/${PLUGIN}`), { installs: 1000 }));
  });

  it('a lista de escritórios que instalaram não é legível', async () => {
    await assertFails(getDoc(doc(asUser(env, 'sistema'), `extension_stats/${PLUGIN}/installs/${TENANT}`)));
  });
});

describe('voto', () => {
  it('o membro de um escritório que instalou vota', async () => {
    await assertSucceeds(setDoc(vote('membro'), ballot()));
  });

  it('e muda o próprio voto, e o retira', async () => {
    await assertSucceeds(setDoc(vote('membro'), ballot()));
    await assertSucceeds(setDoc(vote('membro'), ballot({ stars: 2 })));
    await assertSucceeds(deleteDoc(vote('membro')));
  });

  it('lê o próprio voto', async () => {
    await assertSucceeds(setDoc(vote('membro'), ballot()));
    await assertSucceeds(getDoc(vote('membro')));
  });

  it('não vota em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(asUser(env, 'membro'), `extension_stats/${PLUGIN}/ratings/deFora`), ballot()));
  });

  it('não vota por um escritório que não instalou', async () => {
    await assertFails(setDoc(vote('deFora'), ballot({ tenantId: OTHER_TENANT })));
  });

  it('não vota por um escritório do qual não é membro', async () => {
    await assertFails(setDoc(vote('deFora'), ballot()));
  });

  it('a cópia privada não vota', async () => {
    await seed(env, { records: { [TENANT]: { [`installed_extensions/${PLUGIN}`]: { source: 'private' } } } });
    await assertFails(setDoc(vote('membro'), ballot()));
  });

  it('só de uma a cinco estrelas, inteiras', async () => {
    await assertFails(setDoc(vote('membro'), ballot({ stars: 0 })));
    await assertFails(setDoc(vote('membro'), ballot({ stars: 6 })));
    await assertFails(setDoc(vote('membro'), ballot({ stars: 4.5 })));
  });

  it('não leva campo além dos três', async () => {
    await assertFails(setDoc(vote('membro'), ballot({ weight: 100 })));
  });
});

describe('publicador verificado', () => {
  const publisher = (uid: string) => doc(asUser(env, uid), `extension_publishers/${TENANT}`);
  const seal = (uid: string) => ({ verified: true, verifiedBy: uid, verifiedAt: serverTimestamp() });

  it('todo autenticado lê', async () => {
    await assertSucceeds(getDoc(publisher('membro')));
  });

  it('só o SYSTEM concede e retira', async () => {
    await assertSucceeds(setDoc(publisher('sistema'), seal('sistema')));
    await assertSucceeds(deleteDoc(publisher('sistema')));
  });

  it('o dono não se verifica sozinho', async () => {
    await assertFails(setDoc(publisher('dono'), seal('dono')));
  });
});
