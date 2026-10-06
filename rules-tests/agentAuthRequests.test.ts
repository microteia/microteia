import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * Os PEDIDOS DE AUTORIZAÇÃO de OAuth, e a regra é uma só: ninguém.
 *
 * Fechada nas duas direções para todo cliente, incluindo o SYSTEM. A leitura porque o documento
 * guarda o hash do código de autorização e o escritório que a pessoa consentiu; a escrita porque
 * quem escreve escolhe qual código vale — e um código escolhido é um acesso emitido sem que ninguém
 * tenha autorizado nada.
 *
 * A tela chega ao que precisa por callable, filtrado, e nunca ao `codeHash`. Este teste existe para
 * que uma regra nova acrescentada por engano a esta coleção reprove aqui, e não em produção.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const PEDIDO = 'agentAuthRequests/pedido1';

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { dela: {}, gestor: {}, sistema: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { dela: ['clientes.read'], gestor: ['agent.manage'] } },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as never, PEDIDO), {
      clientId: 'https://claude.ai/oauth/client-metadata',
      clientName: 'Claude',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      codeHash: 'b'.repeat(64),
      tenantId: TENANT,
      userId: 'dela',
      grantId: 'acesso1',
      usedAt: null,
    });
  });
});

describe('agentAuthRequests', () => {
  it('ninguém lê — nem o dono do escritório, nem quem administra agentes, nem o SYSTEM', async () => {
    for (const uid of ['dono', 'dela', 'gestor', 'sistema']) {
      await assertFails(getDoc(doc(asUser(env, uid), PEDIDO)));
    }
  });

  it('ninguém lista a coleção', async () => {
    await assertFails(getDocs(collection(asUser(env, 'gestor'), 'agentAuthRequests')));
  });

  // Quem escreve escolhe qual código vale, e um código escolhido é um acesso que ninguém autorizou.
  it('ninguém cria um pedido', async () => {
    await assertFails(setDoc(doc(asUser(env, 'dela'), 'agentAuthRequests/inventado'), {
      tenantId: TENANT,
      codeHash: 'c'.repeat(64),
    }));
  });

  it('ninguém altera o hash do código de um pedido existente', async () => {
    await assertFails(updateDoc(doc(asUser(env, 'gestor'), PEDIDO), { codeHash: 'd'.repeat(64) }));
  });

  // Apagar o pedido não emite nada, mas desfaria a marca de "já usado" — que é o que impede um
  // código lido no caminho de ser trocado uma segunda vez.
  it('ninguém apaga um pedido', async () => {
    await assertFails(deleteDoc(doc(asUser(env, 'sistema'), PEDIDO)));
  });

  it('ninguém de fora alcança a coleção', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as never, PEDIDO)));
  });
});
