import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra dos RELATÓRIOS, e a assimetria que a define: a DEFINIÇÃO é de todo membro, porque a lista
 * precisa mostrar o que existe; a ESCRITA é de quem gerencia relatórios.
 *
 * O que a regra deliberadamente NÃO faz é decidir o acesso ao dado. Ler a definição de um relatório
 * sobre o financeiro não entrega número nenhum — quem cobra a leitura de cada coleção que o
 * relatório toca é a callable, no servidor, e é lá que o teste dela mora.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { autor: {}, membro: {}, deFora: {}, sistema: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: {
        autor: ['reports.manage'],
        membro: ['lancamentos.read'],
      },
      [OTHER_TENANT]: { deFora: ['reports.manage'] },
    },
    records: {
      [TENANT]: {
        'reports/faturamento': { key: 'faturamento', title: 'Faturamento', origin: 'design' },
      },
    },
  });
});

const report = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/reports/faturamento`);

describe('leitura da definição', () => {
  it('todo membro lê — sem isso ninguém saberia que o relatório existe', async () => {
    await assertSucceeds(getDoc(report('membro')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(report('deFora')));
  });
});

describe('escrita da definição', () => {
  it('quem gerencia relatórios cria, edita e exclui', async () => {
    await assertSucceeds(setDoc(doc(asUser(env, 'autor'), `tenants/${TENANT}/reports/novo`), {
      key: 'novo',
      title: 'Novo',
      origin: 'design',
    }));
    await assertSucceeds(updateDoc(report('autor'), { title: 'Faturamento mensal' }));
    await assertSucceeds(deleteDoc(report('autor')));
  });

  it('membro que só lê um cadastro NÃO escreve relatório', async () => {
    // Criar relatório é um gesto barato de propósito. Se ele não fosse cobrado, qualquer membro
    // poderia declarar uma agregação sobre qualquer coleção.
    await assertFails(updateDoc(report('membro'), { title: 'Meu' }));
    await assertFails(deleteDoc(report('membro')));
  });

  it('quem gerencia relatórios NO OUTRO escritório não escreve neste', async () => {
    await assertFails(updateDoc(report('deFora'), { title: 'Invadido' }));
  });
});

describe('as duas exceções que não são perfil', () => {
  it('o DONO do escritório escreve sem perfil nenhum', async () => {
    await assertSucceeds(updateDoc(report('dono'), { title: 'Do dono' }));
  });

  it('o administrador global escreve', async () => {
    await assertSucceeds(updateDoc(report('sistema'), { title: 'Do sistema' }));
  });
});

describe('a coleção é RESERVADA — o curinga das telas não a alcança', () => {
  it('uma tela chamada `reports` não afrouxa a regra', async () => {
    // O Firestore concede quando QUALQUER regra concede. Sem `reports` na denylist do curinga, um
    // escritório que declarasse uma tela com esse nome ganharia escrita por `reports.create`.
    await seed(env, {
      screens: { [TENANT]: { reports: { titleSingular: 'Relatório', titlePlural: 'Relatórios', fields: [] } } },
      members: { [TENANT]: { membro: ['lancamentos.read', 'reports.create', 'reports.update'] } },
    });

    await assertFails(updateDoc(report('membro'), { title: 'Pelo curinga' }));
  });
});
