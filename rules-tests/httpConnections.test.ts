import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A credencial de integração tem duas metades. A descrição é lida por quem gerencia integrações e por
 * quem monta automações — o editor precisa listar as chaves; só a primeira grava. O segredo é escrito
 * por quem gerencia integrações e NUNCA lido pelo navegador, nem por quem o cadastrou.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { integrador: {}, automatizador: {}, membro: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { integrador: ['integrations.manage'], automatizador: ['automation.manage'], membro: [] },
      [OTHER_TENANT]: { deFora: ['integrations.manage'] },
    },
    records: {
      [TENANT]: {
        'httpConnections/c1': { key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'], hasSecret: true },
        'httpConnections/c1/secrets/current': { value: 'sk_live' },
      },
    },
  });
});

const connection = (uid: string, tenantId: string = TENANT, id = 'c1') =>
  doc(asUser(env, uid), `tenants/${tenantId}/httpConnections/${id}`);
const secret = (uid: string, tenantId: string = TENANT, id = 'c1') =>
  doc(asUser(env, uid), `tenants/${tenantId}/httpConnections/${id}/secrets/current`);

describe('a descrição da credencial', () => {
  it('quem gerencia integrações e quem monta automações leem; o membro comum não', async () => {
    await assertSucceeds(getDoc(connection('integrador')));
    await assertSucceeds(getDoc(connection('automatizador')));
    await assertFails(getDoc(connection('membro')));
  });

  it('só quem gerencia integrações grava e apaga — montar automação não basta', async () => {
    await assertSucceeds(setDoc(connection('integrador', TENANT, 'c2'), { key: 'erp', name: 'ERP', scheme: 'bearer', hosts: ['erp.com'] }));
    await assertFails(setDoc(connection('automatizador', TENANT, 'c3'), { key: 'x', name: 'X', scheme: 'bearer', hosts: ['x.com'] }));
    await assertSucceeds(deleteDoc(connection('integrador', TENANT, 'c2')));
  });

  it('quem é de outro escritório não lê nem grava', async () => {
    await assertFails(getDoc(connection('deFora')));
    await assertFails(setDoc(connection('deFora', TENANT, 'c9'), { key: 'y', name: 'Y', scheme: 'bearer', hosts: ['y.com'] }));
  });
});

describe('o segredo', () => {
  it('ninguém lê pelo navegador — nem quem gerencia integrações, nem o dono', async () => {
    await assertFails(getDoc(secret('integrador')));
    await assertFails(getDoc(secret('automatizador')));
    await assertFails(getDoc(secret('dono')));
  });

  it('quem gerencia integrações escreve e troca; quem monta automações não', async () => {
    await assertSucceeds(setDoc(secret('integrador'), { value: 'novo' }));
    await assertFails(setDoc(secret('automatizador'), { value: 'meu' }));
    await assertFails(setDoc(secret('deFora'), { value: 'meu' }));
  });
});
