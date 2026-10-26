import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { deleteObject, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A janela de edição estendida aos DOCUMENTOS do registro e aos arquivos deles no Storage. Fechada a
 * janela do registro, nenhum caminho do cliente apaga, troca ou renomeia um anexo — nem o dono —, e
 * anexar continua livre. O registro que já foi excluído (a cascata) libera os anexos dele.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const HOUR_AGO = (): Timestamp => Timestamp.fromMillis(Date.now() - 60 * 60_000);
const JUST_NOW = (): Timestamp => Timestamp.fromMillis(Date.now() - 60_000);

const PERMISSOES = [
  'mensagens.read', 'mensagens.create', 'mensagens.update', 'mensagens.delete',
  'livres.read', 'livres.update', 'livres.delete',
  'semJanela.read', 'semJanela.update', 'semJanela.delete',
];

const RECORDS: Record<string, Record<string, unknown>> = {
  'mensagens/recente': { texto: 'oi', createdAt: JUST_NOW() },
  'mensagens/antiga': { texto: 'oi', createdAt: HOUR_AGO() },
  'mensagens/semData': { texto: 'oi' },
  'livres/antiga': { texto: 'oi', createdAt: HOUR_AGO() },
  'semJanela/antigo': { texto: 'oi', createdAt: HOUR_AGO() },
};

const fileOf = (record: string): string => `tenants/${TENANT}/${record}/1700000000_laudo.pdf`;

const documentOf = (record: string): Record<string, unknown> => ({
  name: 'laudo.pdf',
  url: 'https://example.test/laudo.pdf',
  storagePath: fileOf(record),
  createdBy: 'membro',
  createdByName: 'Membro',
  createdAt: HOUR_AGO(),
  sha256: 'a'.repeat(64),
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    users: { membro: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { membro: PERMISSOES } },
    screens: {
      [TENANT]: {
        mensagens: { titleSingular: 'Mensagem', fields: [], hasDocuments: true, editWindow: { minutes: 15, delete: true } },
        livres: { titleSingular: 'Nota', fields: [], hasDocuments: true, editWindow: { minutes: 15 } },
        semJanela: { titleSingular: 'Cadastro', fields: [], hasDocuments: true },
      },
    },
    records: { [TENANT]: RECORDS },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const storage = context.storage() as unknown as FirebaseStorage;
    for (const record of Object.keys(RECORDS)) {
      await setDoc(doc(db, `tenants/${TENANT}/${record}/documents/d1`), documentOf(record));
      await uploadString(ref(storage, fileOf(record)), 'pdf');
    }
  });
});

const document = (uid: string, record: string, id = 'd1') =>
  doc(asUser(env, uid), `tenants/${TENANT}/${record}/documents/${id}`);
const storageOf = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;
const stamp = (uid: string) => ({ deletedBy: uid, deletedByName: uid, deletedByPhotoURL: '' });

const deleteRecord = async (record: string): Promise<void> => {
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore() as unknown as Firestore, `tenants/${TENANT}/${record}`));
  });
};

describe('documentos sob a janela — exclusão', () => {
  it('fechada a janela, ninguém carimba nem exclui o documento — nem o dono', async () => {
    for (const uid of ['membro', 'dono']) {
      await assertFails(updateDoc(document(uid, 'mensagens/antiga'), stamp(uid)));
      await assertFails(deleteDoc(document(uid, 'mensagens/antiga')));
    }
  });

  it('sem `delete: true` no registro, o documento também fica — trocar o anexo é trocar a prova', async () => {
    await assertFails(updateDoc(document('membro', 'livres/antiga'), stamp('membro')));
    await assertFails(deleteDoc(document('membro', 'livres/antiga')));
  });

  it('dentro da janela, exclui', async () => {
    await assertSucceeds(updateDoc(document('membro', 'mensagens/recente'), stamp('membro')));
    await assertSucceeds(deleteDoc(document('membro', 'mensagens/recente')));
  });

  it('registro sem `createdAt` está fechado', async () => {
    await assertFails(deleteDoc(document('membro', 'mensagens/semData')));
  });

  it('o registro já excluído libera os anexos — é a cascata', async () => {
    await deleteRecord('livres/antiga');
    await assertSucceeds(updateDoc(document('membro', 'livres/antiga'), stamp('membro')));
    await assertSucceeds(deleteDoc(document('membro', 'livres/antiga')));
  });

  it('a tela sem janela não muda nada', async () => {
    await assertSucceeds(deleteDoc(document('membro', 'semJanela/antigo')));
  });
});

describe('documentos sob a janela — o que continua', () => {
  it('anexar documento novo continua permitido', async () => {
    await assertSucceeds(setDoc(document('membro', 'mensagens/antiga', 'd2'), {
      name: 'novo.pdf',
      url: 'https://example.test/novo.pdf',
      storagePath: `tenants/${TENANT}/mensagens/antiga/1700000001_novo.pdf`,
      createdBy: 'membro',
      createdByName: 'Membro',
      createdAt: serverTimestamp(),
    }));
  });

  it('compartilhar no portal não é alterar o anexo', async () => {
    await assertSucceeds(updateDoc(document('membro', 'mensagens/antiga'), {
      portalShared: true,
      portalSharedBy: 'membro',
      portalSharedAt: serverTimestamp(),
    }));
  });

  it('renomear, retipar ou apontar para outro arquivo nunca passa — nem dentro da janela', async () => {
    for (const record of ['mensagens/antiga', 'mensagens/recente']) {
      await assertFails(updateDoc(document('dono', record), { name: 'outro.pdf' }));
      await assertFails(updateDoc(document('dono', record), { type: 'contrato' }));
      await assertFails(updateDoc(document('dono', record), { storagePath: fileOf('semJanela/antigo') }));
    }
  });
});

describe('hash do arquivo', () => {
  it('o cliente não escreve `sha256` ao anexar', async () => {
    await assertFails(setDoc(document('membro', 'semJanela/antigo', 'd2'), {
      name: 'x.pdf',
      url: 'https://example.test/x.pdf',
      storagePath: `tenants/${TENANT}/semJanela/antigo/1700000001_x.pdf`,
      createdBy: 'membro',
      createdByName: 'Membro',
      createdAt: serverTimestamp(),
      sha256: 'b'.repeat(64),
    }));
  });

  it('nem o reescreve depois — em tela com ou sem janela', async () => {
    await assertFails(updateDoc(document('dono', 'semJanela/antigo'), { sha256: 'b'.repeat(64) }));
    await assertFails(updateDoc(document('dono', 'mensagens/recente'), { sha256: 'b'.repeat(64) }));
  });
});

describe('arquivos no Storage sob a janela', () => {
  it('fechada a janela, ninguém apaga o arquivo — nem o dono', async () => {
    await assertFails(deleteObject(ref(storageOf('membro'), fileOf('mensagens/antiga'))));
    await assertFails(deleteObject(ref(storageOf('dono'), fileOf('mensagens/antiga'))));
    await assertFails(deleteObject(ref(storageOf('membro'), fileOf('livres/antiga'))));
  });

  it('registro sem `createdAt` está fechado', async () => {
    await assertFails(deleteObject(ref(storageOf('membro'), fileOf('mensagens/semData'))));
  });

  it('sobrescrever o arquivo nunca passa — nem dentro da janela, nem sem janela', async () => {
    await assertFails(uploadString(ref(storageOf('dono'), fileOf('mensagens/antiga')), 'outro'));
    await assertFails(uploadString(ref(storageOf('dono'), fileOf('mensagens/recente')), 'outro'));
    await assertFails(uploadString(ref(storageOf('dono'), fileOf('semJanela/antigo')), 'outro'));
  });

  it('enviar arquivo novo continua permitido depois da janela', async () => {
    await assertSucceeds(uploadString(
      ref(storageOf('membro'), `tenants/${TENANT}/mensagens/antiga/1700000001_novo.pdf`),
      'pdf',
    ));
  });

  it('dentro da janela, sem janela e com o registro excluído, apaga', async () => {
    await assertSucceeds(deleteObject(ref(storageOf('membro'), fileOf('mensagens/recente'))));
    await assertSucceeds(deleteObject(ref(storageOf('membro'), fileOf('semJanela/antigo'))));
    await deleteRecord('livres/antiga');
    await assertSucceeds(deleteObject(ref(storageOf('membro'), fileOf('livres/antiga'))));
  });
});
