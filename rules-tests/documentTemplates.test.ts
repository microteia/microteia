import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra dos MODELOS DE DOCUMENTO: a definição é de todo membro, porque o gesto "Gerar documento"
 * lista os modelos da tela; a escrita é de quem gerencia modelos.
 *
 * O id do documento É a chave do modelo, e a regra o cobra: é isso que faz "um modelo do escritório
 * por chave" ser garantia do banco. Um documento gravado num id e com outra chave no corpo seria um
 * modelo que a tela mostra num lugar e a geração encontra em outro.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { autor: {}, membro: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: {
        autor: ['document-templates.manage'],
        membro: ['contratos.update'],
      },
      [OTHER_TENANT]: { deFora: ['document-templates.manage'] },
    },
    records: {
      [TENANT]: {
        'documentTemplates/recibo': { key: 'recibo', title: 'Recibo', collection: 'pagamentos', format: 'markdown', body: 'x' },
      },
    },
  });
});

const template = (uid: string, key = 'recibo', tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/documentTemplates/${key}`);

const body = (key: string) => ({ key, title: 'Procuração', collection: 'contratos', format: 'markdown', body: '# {{name}}' });

describe('leitura', () => {
  it('todo membro lê — o gesto de gerar lista os modelos da tela', async () => {
    await assertSucceeds(getDoc(template('membro')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(template('deFora')));
  });
});

describe('escrita', () => {
  it('quem gerencia modelos grava e exclui', async () => {
    await assertSucceeds(setDoc(template('autor', 'procuracao'), body('procuracao')));
    await assertSucceeds(deleteDoc(template('autor')));
  });

  it('o dono do escritório grava sem perfil nenhum', async () => {
    await assertSucceeds(setDoc(template('dono', 'procuracao'), body('procuracao')));
  });

  it('poder editar registros não é poder escrever modelo', async () => {
    await assertFails(setDoc(template('membro', 'procuracao'), body('procuracao')));
    await assertFails(deleteDoc(template('membro')));
  });

  it('a chave do corpo tem de ser a do id', async () => {
    await assertFails(setDoc(template('autor', 'procuracao'), body('outra')));
  });

  it('a permissão de outro escritório não vale aqui', async () => {
    await assertFails(setDoc(template('deFora', 'procuracao'), body('procuracao')));
  });
});
