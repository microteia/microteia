import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O relógio das automações temporais é do SERVIDOR: quem escreve `nextRunAt` decide quando o kernel
 * age. Todo membro lê, porque é dele que o editor tira "roda de novo em…"; ninguém grava — nem quem
 * gerencia automações, que muda o horário pela definição e deixa o kernel recalcular.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { membro: [], gestor: ['automation.manage'] },
      [OTHER_TENANT]: { deFora: ['automation.manage'] },
    },
    records: {
      [TENANT]: { 'workflow_clock/wf': { kind: 'schedule', cron: '0 8 * * *', nextRunAt: new Date('2026-10-13T11:00:00Z') } },
    },
  });
});

const entry = (uid: string, tenantId: string = TENANT, id = 'wf') =>
  doc(asUser(env, uid), `tenants/${tenantId}/workflow_clock/${id}`);

describe('o relógio das automações temporais', () => {
  it('todo membro lê', async () => {
    await assertSucceeds(getDoc(entry('membro')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(entry('deFora')));
  });

  it('ninguém grava pelo cliente, nem quem gerencia automações, nem o dono', async () => {
    await assertFails(updateDoc(entry('gestor'), { nextRunAt: new Date('2026-10-12T00:00:00Z') }));
    await assertFails(setDoc(entry('gestor', TENANT, 'novo'), { kind: 'schedule', cron: '* * * * *', nextRunAt: new Date() }));
    await assertFails(deleteDoc(entry('dono')));
  });
});

describe('as marcas de "já disparou" do gatilho de data', () => {
  const mark = (uid: string, id = 'wf_r1_2026-10-13') => doc(asUser(env, uid), `tenants/${TENANT}/workflow_trigger_marks/${id}`);

  it('ninguém lê, cria nem apaga pelo cliente — criar suprimiria o aviso, apagar o repetiria', async () => {
    await assertFails(getDoc(mark('dono')));
    await assertFails(setDoc(mark('gestor', 'wf_r2_2026-10-14'), { definitionId: 'wf', expiresAt: new Date() }));
    await assertFails(deleteDoc(mark('dono')));
  });
});
