import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A janela de edição (`editWindow`) como SEGURANÇA: o que vale contra quem grava direto no banco, sem
 * passar pelo formulário nem pelo backend. Cada trava e cada isenção da regra tem um caso aqui.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const HOUR_AGO = (): Timestamp => Timestamp.fromMillis(Date.now() - 60 * 60_000);
const JUST_NOW = (): Timestamp => Timestamp.fromMillis(Date.now() - 60_000);

const ESCREVE = ['mensagens.read', 'mensagens.create', 'mensagens.update', 'mensagens.delete'];

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, leitor: {}, desenhista: {}, instalador: {}, prazos: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        membro: [...ESCREVE, 'livres.read', 'livres.update', 'livres.delete', 'quebradas.update'],
        leitor: ['mensagens.read'],
        desenhista: ['screens.manage'],
        instalador: ['extensions.manage'],
        prazos: ['screens.manage', 'screens.edit-window'],
      },
    },
    screens: {
      [TENANT]: {
        mensagens: {
          titleSingular: 'Mensagem',
          fields: [],
          editWindow: { minutes: 15, delete: true },
          memberWritableFields: ['lidaPor'],
        },
        livres: { titleSingular: 'Nota', fields: [], editWindow: { minutes: 15 } },
        quebradas: { titleSingular: 'Quebrada', fields: [], editWindow: { minutes: 15.5 } },
        semJanela: { titleSingular: 'Cadastro', fields: [] },
      },
    },
    records: {
      [TENANT]: {
        'mensagens/recente': { texto: 'oi', createdAt: JUST_NOW(), lidaPor: [] },
        'mensagens/antiga': { texto: 'oi', createdAt: HOUR_AGO(), lidaPor: [] },
        'mensagens/semData': { texto: 'oi', lidaPor: [] },
        'livres/antiga': { texto: 'oi', createdAt: HOUR_AGO() },
        'quebradas/recente': { texto: 'oi', createdAt: JUST_NOW() },
        'semJanela/antigo': { texto: 'oi', createdAt: HOUR_AGO() },
      },
    },
  });
});

const record = (uid: string, path: string) => doc(asUser(env, uid), `tenants/${TENANT}/${path}`);

describe('janela de edição — criação', () => {
  it('nasce com o relógio do servidor', async () => {
    await assertSucceeds(setDoc(record('membro', 'mensagens/nova'), { texto: 'oi', createdAt: serverTimestamp() }));
  });

  it('recusa `createdAt` escolhido pelo cliente — compraria uma janela eterna', async () => {
    const future = Timestamp.fromMillis(Date.now() + 365 * 24 * 60 * 60_000);
    await assertFails(setDoc(record('membro', 'mensagens/nova'), { texto: 'oi', createdAt: future }));
  });

  it('recusa nascer sem `createdAt`', async () => {
    await assertFails(setDoc(record('membro', 'mensagens/nova'), { texto: 'oi' }));
  });
});

describe('janela de edição — alteração', () => {
  it('dentro do prazo, altera', async () => {
    await assertSucceeds(updateDoc(record('membro', 'mensagens/recente'), { texto: 'olá' }));
  });

  it('fora do prazo, recusa — inclusive o dono do escritório', async () => {
    await assertFails(updateDoc(record('membro', 'mensagens/antiga'), { texto: 'olá' }));
    await assertFails(updateDoc(record('dono', 'mensagens/antiga'), { texto: 'olá' }));
  });

  it('nunca regrava `createdAt`, nem dentro do prazo', async () => {
    await assertFails(updateDoc(record('membro', 'mensagens/recente'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(record('membro', 'mensagens/antiga'), { createdAt: serverTimestamp() }));
  });

  it('o campo que qualquer membro grava passa depois do prazo', async () => {
    await assertSucceeds(updateDoc(record('leitor', 'mensagens/antiga'), { lidaPor: ['leitor'], updatedAt: serverTimestamp() }));
  });

  it('registro sem `createdAt` está fechado, não aberto para sempre', async () => {
    await assertFails(updateDoc(record('membro', 'mensagens/semData'), { texto: 'olá' }));
  });

  it('declaração malformada fecha', async () => {
    await assertFails(updateDoc(record('membro', 'quebradas/recente'), { texto: 'olá' }));
  });

  it('a tela sem janela não muda nada', async () => {
    await assertSucceeds(updateDoc(record('dono', 'semJanela/antigo'), { texto: 'olá' }));
  });
});

describe('janela de edição — exclusão', () => {
  const stamp = { deletedBy: 'membro', deletedByName: 'Membro', deletedByPhotoURL: '' };

  it('com `delete: true`, recusa o carimbo e a exclusão depois do prazo', async () => {
    await assertFails(updateDoc(record('membro', 'mensagens/antiga'), stamp));
    await assertFails(deleteDoc(record('membro', 'mensagens/antiga')));
    await assertFails(deleteDoc(record('dono', 'mensagens/antiga')));
  });

  it('com `delete: true`, exclui dentro do prazo', async () => {
    await assertSucceeds(updateDoc(record('membro', 'mensagens/recente'), stamp));
    await assertSucceeds(deleteDoc(record('membro', 'mensagens/recente')));
  });

  it('sem `delete`, a exclusão segue só a permissão — o carimbo passa depois do prazo', async () => {
    await assertSucceeds(updateDoc(record('membro', 'livres/antiga'), stamp));
    await assertSucceeds(deleteDoc(record('membro', 'livres/antiga')));
  });

  it('sem `delete`, o carimbo de exclusão não serve de porta para o conteúdo', async () => {
    await assertFails(updateDoc(record('membro', 'livres/antiga'), { ...stamp, texto: 'olá' }));
  });
});

describe('janela de edição — quem muda a declaração', () => {
  const screen = (uid: string, key: string) => doc(asUser(env, uid), `tenants/${TENANT}/screenDefinitions/${key}`);

  it('quem desenha telas não abre nem retira a janela', async () => {
    await assertFails(updateDoc(screen('desenhista', 'mensagens'), { editWindow: { minutes: 600, delete: true } }));
    await assertFails(updateDoc(screen('desenhista', 'mensagens'), { editWindow: null }));
    await assertFails(updateDoc(screen('desenhista', 'semJanela'), { editWindow: { minutes: 5 } }));
    await assertFails(setDoc(screen('desenhista', 'nova'), { titleSingular: 'Nova', fields: [], editWindow: { minutes: 5 } }));
  });

  it('quem desenha telas continua salvando o resto — inclusive reenviando a janela como está', async () => {
    await assertSucceeds(updateDoc(screen('desenhista', 'mensagens'), {
      titleSingular: 'Recado',
      editWindow: { minutes: 15, delete: true },
    }));
    await assertSucceeds(updateDoc(screen('desenhista', 'semJanela'), { titleSingular: 'Ficha', editWindow: null }));
  });

  it('quem tem `screens.edit-window` define, muda e retira a janela pelo Form Design', async () => {
    await assertSucceeds(updateDoc(screen('prazos', 'semJanela'), { editWindow: { minutes: 5 } }));
    await assertSucceeds(updateDoc(screen('prazos', 'mensagens'), { editWindow: null }));
    await assertSucceeds(setDoc(screen('prazos', 'nova'), { titleSingular: 'Nova', fields: [], editWindow: { minutes: 5 } }));
  });

  it('quem instala extensões muda a janela', async () => {
    await assertSucceeds(updateDoc(screen('instalador', 'mensagens'), { editWindow: { minutes: 30, delete: true } }));
  });
});
