import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra de DOWNLOADS: o arquivo gerado que não foi anexado a um registro.
 *
 * Quem grava é só o servidor. O dono vê e apaga o seu; o arquivo da automação sem pessoa vale para
 * todos ou só para quem gerencia, conforme a visibilidade carimbada nele; `downloads.manage` vê tudo.
 * As duas consultas da tela — por dono e por `everyone` — têm de ser provadas pela regra sem ler
 * documento nenhum, ou a lista inteira é recusada.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const item = (ownerId: string | null, visibility: string) => ({
  name: 'Recibo.pdf',
  url: 'https://x',
  storagePath: 'p',
  ownerId,
  visibility,
  createdAt: new Date('2026-10-17T12:00:00Z'),
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, bia: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { ana: [], bia: [], gestor: ['downloads.manage'] },
      [OTHER_TENANT]: { deFora: ['downloads.manage'] },
    },
    records: {
      [TENANT]: {
        'downloads/daAna': item('ana', 'owner'),
        'downloads/livre': item(null, 'everyone'),
        'downloads/restrito': item(null, 'managers'),
      },
    },
  });
});

const download = (uid: string, id: string) => doc(asUser(env, uid), `tenants/${TENANT}/downloads/${id}`);

const downloads = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/downloads`);

describe('leitura', () => {
  it('o dono lê o seu, e outra pessoa não', async () => {
    await assertSucceeds(getDoc(download('ana', 'daAna')));
    await assertFails(getDoc(download('bia', 'daAna')));
  });

  it('o arquivo da automação liberado para todos é de todo membro; o restrito, só de quem gerencia', async () => {
    await assertSucceeds(getDoc(download('bia', 'livre')));
    await assertFails(getDoc(download('bia', 'restrito')));
    await assertSucceeds(getDoc(download('gestor', 'restrito')));
  });

  it('o dono do escritório vê tudo sem perfil nenhum', async () => {
    await assertSucceeds(getDoc(download('dono', 'daAna')));
    await assertSucceeds(getDoc(download('dono', 'restrito')));
  });

  it('a permissão de outro escritório não vale aqui', async () => {
    await assertFails(getDoc(download('deFora', 'livre')));
  });

  it('as consultas da tela são provadas pelo filtro', async () => {
    await assertSucceeds(getDocs(query(downloads('bia'), where('ownerId', '==', 'bia'), orderBy('createdAt', 'desc'), limit(100))));
    await assertSucceeds(getDocs(query(downloads('bia'), where('visibility', '==', 'everyone'), orderBy('createdAt', 'desc'), limit(100))));
    await assertSucceeds(getDocs(query(downloads('gestor'), orderBy('createdAt', 'desc'), limit(100))));
  });

  it('sem filtro e sem gerenciar, a lista é recusada', async () => {
    await assertFails(getDocs(query(downloads('bia'), orderBy('createdAt', 'desc'), limit(100))));
  });
});

describe('escrita', () => {
  it('ninguém grava pelo cliente — nem quem gerencia', async () => {
    await assertFails(setDoc(download('ana', 'novo'), item('ana', 'owner')));
    await assertFails(setDoc(download('gestor', 'daAna'), item('gestor', 'owner')));
  });

  it('o dono apaga o seu; quem gerencia apaga qualquer um; os demais, não', async () => {
    await assertFails(deleteDoc(download('bia', 'daAna')));
    await assertSucceeds(deleteDoc(download('ana', 'daAna')));
    await assertSucceeds(deleteDoc(download('gestor', 'restrito')));
  });
});
