import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra dos relatórios PESSOAIS: só o autor vê, e nem o dono do escritório os lê — o relatório só
 * conta o que o autor já pode ler, então escondê-lo não esconde dado, só a pergunta de cada um.
 *
 * A lista é uma CONSULTA por `ownerId`: a regra não filtra, ela recusa a leitura que poderia trazer o
 * relatório de outro membro — por isso há teste da consulta, e não só do documento.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, bia: {}, semPermissao: {}, gestora: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: {
        ana: ['reports.personal'],
        bia: ['reports.personal'],
        semPermissao: ['lancamentos.read'],
        gestora: ['reports.personal', 'reports.manage'],
      },
      [OTHER_TENANT]: { deFora: ['reports.personal'] },
    },
    records: {
      [TENANT]: {
        'personalReports/daAna': { ownerId: 'ana', key: 'meu', title: 'Meu', origin: 'design' },
        'personalReports/daGestora': { ownerId: 'gestora', key: 'vendas', title: 'Vendas', origin: 'design' },
        'personalReports/semPermissaoAntigo': { ownerId: 'semPermissao', key: 'velho', title: 'Velho', origin: 'design' },
      },
    },
  });
});

const personal = (uid: string, id: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/personalReports/${id}`);

describe('leitura', () => {
  it('o autor lê o seu, e a lista dele pela consulta por ownerId', async () => {
    await assertSucceeds(getDoc(personal('ana', 'daAna')));
    await assertSucceeds(getDocs(query(
      collection(asUser(env, 'ana'), `tenants/${TENANT}/personalReports`),
      where('ownerId', '==', 'ana'),
    )));
  });

  it('outro membro não lê — nem o dono do escritório', async () => {
    await assertFails(getDoc(personal('bia', 'daAna')));
    await assertFails(getDoc(personal('dono', 'daAna')));
  });

  it('a consulta sem filtro por autor é recusada, mesmo a quem só tem os próprios', async () => {
    await assertFails(getDocs(collection(asUser(env, 'ana'), `tenants/${TENANT}/personalReports`)));
  });

  it('quem é de outro escritório não lê', async () => {
    await assertFails(getDoc(personal('deFora', 'daAna')));
  });
});

describe('escrita', () => {
  it('cria com a permissão, como autor de si mesmo', async () => {
    await assertSucceeds(setDoc(personal('ana', 'novo'), { ownerId: 'ana', key: 'novo', title: 'Novo', origin: 'design' }));
  });

  it('não cria em nome de outro, nem sem a permissão', async () => {
    await assertFails(setDoc(personal('ana', 'falso'), { ownerId: 'bia', key: 'falso', title: 'Falso', origin: 'design' }));
    await assertFails(setDoc(personal('semPermissao', 'novo'), { ownerId: 'semPermissao', key: 'n', title: 'N', origin: 'design' }));
  });

  it('o autor edita o seu, mas não o passa para outro', async () => {
    await assertSucceeds(updateDoc(personal('ana', 'daAna'), { title: 'Meu, mensal' }));
    await assertFails(updateDoc(personal('ana', 'daAna'), { ownerId: 'bia' }));
  });

  it('outro membro não edita nem apaga', async () => {
    await assertFails(updateDoc(personal('bia', 'daAna'), { title: 'Meu agora' }));
    await assertFails(deleteDoc(personal('bia', 'daAna')));
  });

  it('quem perdeu a permissão ainda apaga o que é seu, mas não edita', async () => {
    await assertFails(updateDoc(personal('semPermissao', 'semPermissaoAntigo'), { title: 'x' }));
    await assertSucceeds(deleteDoc(personal('semPermissao', 'semPermissaoAntigo')));
  });
});

describe('compartilhar com o escritório', () => {
  it('quem gerencia relatórios leva o seu para os do escritório, num lote', async () => {
    const db = asUser(env, 'gestora');
    const batch = writeBatch(db);
    batch.set(doc(db, `tenants/${TENANT}/reports/vendas`), { key: 'vendas', title: 'Vendas', origin: 'design', createdBy: 'gestora' });
    batch.delete(doc(db, `tenants/${TENANT}/personalReports/daGestora`));
    await assertSucceeds(batch.commit());
  });

  it('quem só tem a permissão pessoal não compartilha — a escrita nos do escritório é recusada', async () => {
    const db = asUser(env, 'ana');
    const batch = writeBatch(db);
    batch.set(doc(db, `tenants/${TENANT}/reports/meu`), { key: 'meu', title: 'Meu', origin: 'design', createdBy: 'ana' });
    batch.delete(doc(db, `tenants/${TENANT}/personalReports/daAna`));
    await assertFails(batch.commit());
  });
});
