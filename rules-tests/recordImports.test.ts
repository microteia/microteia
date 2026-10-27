import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O job da importação em massa é do SERVIDOR, de ponta a ponta. Ninguém lê — a tela recebe tudo pela
 * callable — e ninguém grava: quem escrevesse os totais faria a linha de Auditoria da importação contar o
 * que não aconteceu.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { importador: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { importador: ['record-import.run', 'pessoas.create', 'pessoas.update'] } },
    records: {
      [TENANT]: {
        'record_imports/imp1': {
          table: 'pessoas',
          createdBy: 'importador',
          status: 'running',
          totals: { created: 1, updated: 0, failed: 0 },
        },
      },
    },
  });
});

const job = (uid: string, id = 'imp1') => doc(asUser(env, uid), `tenants/${TENANT}/record_imports/${id}`);

describe('o job da importação em massa', () => {
  it('ninguém lê do cliente — nem quem importou, nem o dono', async () => {
    await assertFails(getDoc(job('importador')));
    await assertFails(getDoc(job('dono')));
  });

  it('ninguém grava do cliente', async () => {
    await assertFails(updateDoc(job('importador'), { totals: { created: 1000, updated: 0, failed: 0 } }));
    await assertFails(updateDoc(job('dono'), { status: 'finished' }));
    await assertFails(setDoc(job('importador', 'novo'), { table: 'pessoas', status: 'running' }));
    await assertFails(deleteDoc(job('dono')));
  });

  it('o nome é reservado: uma tela chamada record_imports não abre a coleção', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `tenants/${TENANT}/screenDefinitions/record_imports`), {
        titleSingular: 'x', titleFieldKey: 'x', fields: [],
      });
    });
    await assertFails(setDoc(job('dono', 'forjado'), { status: 'finished' }));
    await assertFails(getDoc(job('dono')));
  });
});
