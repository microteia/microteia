import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * POR ONDE uma gravação entrou (`createdVia`/`updatedVia`) e QUEM disparou uma automação (`actor` no
 * evento) são escritos pelo Admin SDK. O cliente só pode dizer `ui` — senão uma tela, ou uma extensão
 * rodando nela, faria um registro digitado passar por gravado pela IA, ou dispararia um fluxo em nome
 * de outra pessoa.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { escritor: {}, leitor: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        escritor: ['pet1.read', 'pet1.create', 'pet1.update', 'automation.run'],
        leitor: ['pet1.read'],
      },
    },
    screens: {
      [TENANT]: { pet1: { titleSingular: 'Pet', titlePlural: 'Pets', fields: [], memberWritableFields: ['lidoPor'] } },
    },
    records: {
      [TENANT]: {
        'pet1/r1': { nome: 'Rex', createdBy: 'u-x', createdVia: 'agent', updatedVia: 'agent' },
        'pet1/r2': { nome: 'Tom', total: 10, createdBy: 'u-x', updatedBy: 'aggregate-engine', updatedVia: 'aggregate-backfill' },
      },
    },
  });
});

const pets = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/pet1`);
const pet = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/pet1/r1`);

describe('o cliente só declara `ui`', () => {
  it('cria com `createdVia: ui`, ou sem o campo', async () => {
    await assertSucceeds(addDoc(pets('escritor'), { nome: 'Bob', createdVia: 'ui', updatedVia: 'ui' }));
    await assertSucceeds(addDoc(pets('escritor'), { nome: 'Bob' }));
  });

  it('não cria passando-se por agente ou automação', async () => {
    await assertFails(addDoc(pets('escritor'), { nome: 'Bob', createdVia: 'agent' }));
    await assertFails(addDoc(pets('escritor'), { nome: 'Bob', createdVia: 'automation' }));
    await assertFails(addDoc(pets('escritor'), { nome: 'Bob', updatedVia: 'agent' }));
  });

  it('edita marcando `updatedVia: ui` sobre um registro gravado pelo agente, e não reescreve `createdVia`', async () => {
    await assertSucceeds(updateDoc(pet('escritor'), { nome: 'Rex II', updatedVia: 'ui' }));
    await assertFails(updateDoc(pet('escritor'), { nome: 'Rex III', updatedVia: 'agent' }));
    await assertFails(updateDoc(pet('escritor'), { createdVia: 'ui' }));
  });

  it('o campo "por usuário" de um mural continua gravável por qualquer membro, com o carimbo `ui`', async () => {
    await assertSucceeds(updateDoc(pet('leitor'), { lidoPor: ['leitor'], updatedVia: 'ui' }));
  });
});

describe('a marca do recálculo de agregados', () => {
  const recalculado = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/pet1/r2`);

  it('o cliente não a escreve', async () => {
    await assertFails(updateDoc(pet('escritor'), { nome: 'Rex II', updatedVia: 'aggregate-backfill' }));
  });

  it('nem a herda: editar o registro recalculado sem carimbar `ui` é recusado', async () => {
    await assertFails(updateDoc(recalculado('escritor'), { total: 999 }));
    await assertFails(updateDoc(recalculado('escritor'), { nome: 'Tom II' }));
  });

  it('editar o registro recalculado como a tela edita — carimbando `ui` — continua valendo', async () => {
    await assertSucceeds(updateDoc(recalculado('escritor'), { nome: 'Tom II', updatedVia: 'ui' }));
  });

  it('o carimbo de exclusão, que não carimba `ui`, continua valendo', async () => {
    await assertSucceeds(updateDoc(recalculado('escritor'), {
      deletedBy: 'escritor',
      deletedByName: 'Escritor',
      deletedByPhotoURL: '',
    }));
  });

  it('e apagar a marca sem carimbar `ui` também é recusado', async () => {
    await assertFails(updateDoc(recalculado('escritor'), { updatedVia: deleteField() }));
  });
});

describe('o evento de automação publicado pelo cliente', () => {
  const event = (uid: string, id: string) => doc(asUser(env, uid), `tenants/${TENANT}/workflow_events/${id}`);

  it('é aceito sem ator', async () => {
    await assertSucceeds(setDoc(event('escritor', 'e1'), { name: 'workflow.called', payload: {} }));
  });

  it('é recusado se trouxer `actor` — quem disparou é escrito só pelo servidor', async () => {
    await assertFails(setDoc(event('escritor', 'e2'), {
      name: 'workflow.called',
      payload: {},
      actor: { userId: 'outra-pessoa', name: 'Outra', photoURL: '', via: 'ui' },
    }));
  });

  it('é recusado se trouxer `target` — só o relógio do kernel acorda uma automação pelo id', async () => {
    await assertFails(setDoc(event('escritor', 'e3'), { name: 'schedule', payload: {}, target: 'wf-qualquer' }));
  });

  it('é recusado se for `audit.recorded` — o evento de auditoria só nasce de um log gravado pelo servidor', async () => {
    await assertFails(setDoc(event('escritor', 'e4'), { name: 'audit.recorded', payload: { severity: 'CRITICAL' } }));
  });
});
