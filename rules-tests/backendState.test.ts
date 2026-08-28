import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * `backend_state/current` — o que o provisionamento deixou para trás no projeto.
 *
 * O documento existe para que a tela de Extensões possa avisar quem NÃO tem acesso ao projeto Firebase
 * de que há Cloud Function e índice a retirar. Ele é escrito só pelo Microteia Console, com credencial de
 * administrador, que não passa por estas regras — então a parte que estas regras respondem é uma só, e é
 * a que importa: o cliente lê e NUNCA escreve.
 *
 * Escrita liberada seria pior que a ausência do documento. Um admin de escritório poderia forjar a lista
 * de órfãs e, com ela, mandar quem cuida do projeto rodar `--prune` contra a function de outra extensão.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const RESIDUE = 'backend_state/current';

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { users: { membro: {}, sistema: { role: 'SYSTEM' } } });

  // Semeado com as regras desligadas porque é o Console que escreve — com credencial de administrador,
  // que não é um cliente e não passa por aqui.
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, RESIDUE), {
      scannedAt: new Date(),
      consoleVersion: '2.15.0',
      tenants: 1,
      extensions: 2,
      orphanFunctions: [{ name: 'acmeSync', owner: 'com.acme.crm' }],
      orphanIndexes: [],
    });
  });
});

describe('o resíduo de backend do projeto', () => {
  it('qualquer autenticado lê — é o aviso da tela de Extensões, e não dado de escritório', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'membro'), RESIDUE)));
  });

  it('quem não entrou não lê', async () => {
    await assertFails(getDoc(doc(asAnonymous(env), RESIDUE)));
  });

  /**
   * Nem o SYSTEM escreve, e a exceção não existe de propósito: quem escreve é o Console, e uma regra que
   * permitisse a escrita pelo cliente daria a alguém a chance de forjar a lista que manda apagar
   * function do projeto.
   */
  it('nem o SYSTEM escreve: quem escreve é o Console, fora destas regras', async () => {
    await assertFails(setDoc(doc(asUser(env, 'sistema'), RESIDUE), { tenants: 99 }));
  });

  it('um membro comum não escreve', async () => {
    await assertFails(setDoc(doc(asUser(env, 'membro'), RESIDUE), { tenants: 99 }));
  });

  it('ninguém apaga o aviso para fazê-lo sair da tela', async () => {
    await assertFails(deleteDoc(doc(asUser(env, 'sistema'), RESIDUE)));
  });
});
