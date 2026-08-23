import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O curinga `match /{screenCollection}/{recordId}` — a regra que decide o acesso a QUALQUER coleção
 * de tela, e por isso a mais importante do arquivo. Ela monta o nome da permissão a partir da
 * própria coleção, e é o que faz o RBAC valer para uma tela criada cinco minutos atrás.
 */
let env: RulesTestEnvironment;

const SCREEN = { titleSingular: 'Pet', titlePlural: 'Pets', fields: [] };

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { leitor: {}, escritor: {}, faxineiro: {}, forasteiro: {}, dono: {}, sys: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outro-dono' },
    members: {
      [TENANT]: {
        leitor: ['pet1.read'],
        escritor: ['pet1.read', 'pet1.create', 'pet1.update'],
        faxineiro: ['pet1.read', 'pet1.delete'],
        // O DONO entra SEM nada materializado: é o caso em que a regra tem de deixá-lo passar por
        // `Tenant.ownerId`, e não pelo curinga.
        dono: [],
        semnada: [],
      },
      [OTHER_TENANT]: { forasteiro: ['pet1.read', 'pet1.create', 'pet1.delete'] },
    },
    screens: { [TENANT]: { pet1: SCREEN }, [OTHER_TENANT]: { pet1: SCREEN } },
    records: { [TENANT]: { 'pet1/r1': { nome: 'Rex', createdBy: 'escritor' } } },
  });
});

const pets = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/pet1`);
const pet = (uid: string, id = 'r1') => doc(asUser(env, uid), `tenants/${TENANT}/pet1/${id}`);

describe('ler registros de uma tela', () => {
  it('quem tem `pet1.read` lê', async () => {
    await assertSucceeds(getDoc(pet('leitor')));
    await assertSucceeds(getDocs(pets('leitor')));
  });

  it('membro do escritório SEM a permissão não lê', async () => {
    await assertFails(getDoc(pet('semnada')));
    await assertFails(getDocs(pets('semnada')));
  });

  it('quem não é membro não lê', async () => {
    await assertFails(getDoc(pet('forasteiro')));
  });
});

describe('gravar registros de uma tela', () => {
  it('`create` cria e `read` sozinho não', async () => {
    await assertSucceeds(addDoc(pets('escritor'), { nome: 'Bob' }));
    await assertFails(addDoc(pets('leitor'), { nome: 'Bob' }));
  });

  it('`update` altera e `read` sozinho não', async () => {
    await assertSucceeds(updateDoc(pet('escritor'), { nome: 'Rex II' }));
    await assertFails(updateDoc(pet('leitor'), { nome: 'Rex II' }));
  });

  it('`delete` exclui, e quem só cria e edita NÃO exclui', async () => {
    await assertFails(deleteDoc(pet('escritor')));
    await assertSucceeds(deleteDoc(pet('faxineiro')));
  });
});

describe('a coleção precisa ser declarada por uma tela', () => {
  it('coleção inventada não recebe gravação, mesmo com permissão de nome igual', async () => {
    await seed(env, { members: { [TENANT]: { escritor: ['fantasma.create', 'fantasma.read'] } } });
    const inventada = collection(asUser(env, 'escritor'), `tenants/${TENANT}/fantasma`);
    await assertFails(addDoc(inventada, { x: 1 }));
  });

  it('coleção RESERVADA não passa pelo curinga', async () => {
    const reservada = doc(asUser(env, 'escritor'), `tenants/${TENANT}/workflow_executions/x`);
    await assertFails(setDoc(reservada, { x: 1 }));
  });
});

describe('isolamento entre escritórios', () => {
  it('a permissão vale no escritório em que foi concedida, e só nele', async () => {
    const outro = collection(asUser(env, 'forasteiro'), `tenants/${OTHER_TENANT}/pet1`);
    await assertSucceeds(addDoc(outro, { nome: 'Lá' }));
    await assertFails(addDoc(pets('forasteiro'), { nome: 'Aqui' }));
  });

  it('quem grava aqui não grava lá', async () => {
    const outro = collection(asUser(env, 'escritor'), `tenants/${OTHER_TENANT}/pet1`);
    await assertFails(addDoc(outro, { nome: 'Lá' }));
  });
});

describe('as duas exceções', () => {
  it('o DONO passa sem nada materializado — a regra o lê de `Tenant.ownerId`', async () => {
    await assertSucceeds(getDoc(pet('dono')));
    await assertSucceeds(addDoc(pets('dono'), { nome: 'Do dono' }));
    await assertSucceeds(deleteDoc(pet('dono')));
  });

  it('o dono de OUTRO escritório não é dono deste', async () => {
    await seed(env, { members: { [TENANT]: { 'outro-dono': [] } } });
    await assertFails(addDoc(pets('outro-dono'), { nome: 'Não' }));
  });

  it('o administrador GLOBAL passa sem ser membro', async () => {
    await assertSucceeds(getDoc(pet('sys')));
    await assertSucceeds(addDoc(pets('sys'), { nome: 'Sys' }));
  });
});
