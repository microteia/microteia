import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra dos ACESSOS DE AGENTE DE IA, e as duas decisões que a definem.
 *
 * A primeira é a leitura ASSIMÉTRICA: o dono lê o seu porque a tela precisa listar o que ele emitiu;
 * quem tem `agent.manage` lê os de todos porque é quem responde por revogar o de alguém que saiu. Um
 * membro qualquer não lê o de outro — a lista de agentes de uma pessoa diz com o que ela trabalha.
 *
 * A segunda é a escrita FECHADA para todo cliente, sem exceção, e ela não é rigor: o segredo tem de
 * ser sorteado no servidor e o documento só pode nascer com o HASH dele. Uma escrita direta
 * permitiria gravar um `secretHash` escolhido — e quem escolhe o hash escolhe o token, o que
 * transformaria a coleção inteira numa porta de entrada.
 *
 * A exceção é APAGAR o que já não autentica (revogado ou com o consentimento vencido): é limpeza da
 * lista, não grava campo nenhum, e o acesso ativo continua só saindo de uso pela callable.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { dela: {}, dele: {}, gestor: {}, deFora: {}, sistema: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: {
        dela: ['clientes.read'],
        dele: ['clientes.read'],
        gestor: ['agent.manage'],
      },
      [OTHER_TENANT]: { deFora: ['agent.manage'] },
    },
    records: {
      [TENANT]: {
        'agentGrants/dela1': {
          userId: 'dela',
          name: 'Claude no terminal',
          permissions: ['clientes.read'],
          secretHash: 'a'.repeat(64),
          expiresAt: null,
          revokedAt: null,
        },
      },
    },
  });
});

const grant = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/agentGrants/dela1`);

describe('leitura', () => {
  it('o dono lê o seu — sem isso a tela dele não lista nada', async () => {
    await assertSucceeds(getDoc(grant('dela')));
  });

  it('quem tem agent.manage lê o de outro, porque é quem responde por revogá-lo', async () => {
    await assertSucceeds(getDoc(grant('gestor')));
  });

  // A lista de agentes de uma pessoa diz com o que ela trabalha, e ser colega não dá direito a isso.
  it('um membro qualquer NÃO lê o de outro', async () => {
    await assertFails(getDoc(grant('dele')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(grant('deFora')));
  });

  // Sem o `isMember` da regra, este caso passaria: o `userId` do documento ainda casa com o uid de
  // quem saiu, e o casamento sozinho abriria a leitura. Todo o resto do produto é escopado por
  // participação, e este documento não pode ser a exceção.
  it('quem SAIU do escritório não lê mais o acesso que emitiu', async () => {
    await seed(env, {
      users: { exMembro: {} },
      owners: { [OTHER_TENANT]: 'outroDono' },
      records: {
        [OTHER_TENANT]: {
          'agentGrants/dele1': { userId: 'exMembro', name: 'De quando eu era', permissions: [] },
        },
      },
    });

    await assertFails(getDoc(doc(asUser(env, 'exMembro'), `tenants/${OTHER_TENANT}/agentGrants/dele1`)));
  });

  // A consulta de coleção é recusada porque a regra decide por documento: quem não pode ler todos
  // não recebe a lista. A tela do dono a faz com o filtro que a regra satisfaz.
  it('a consulta da coleção inteira falha para quem não lê todos', async () => {
    await assertFails(getDocs(collection(asUser(env, 'dele'), `tenants/${TENANT}/agentGrants`)));
  });
});

describe('escrita — fechada para todo cliente', () => {
  it('o dono não cria o seu: quem escolhe o hash escolhe o token', async () => {
    await assertFails(setDoc(doc(asUser(env, 'dela'), `tenants/${TENANT}/agentGrants/novo`), {
      userId: 'dela',
      name: 'Feito à mão',
      permissions: ['clientes.read'],
      secretHash: 'b'.repeat(64),
    }));
  });

  it('quem gerencia também não cria', async () => {
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/agentGrants/novo`), {
      userId: 'gestor',
      name: 'Feito à mão',
      permissions: [],
      secretHash: 'c'.repeat(64),
    }));
  });

  // Revogar é da callable. Deixar o cliente escrever `revokedAt` deixaria escrever o resto também:
  // a regra não distingue campo, e um `update` liberado alcança `permissions` e `secretHash`.
  it('nem o dono nem o gestor revogam por escrita direta', async () => {
    await assertFails(updateDoc(grant('dela'), { revokedAt: new Date() }));
    await assertFails(updateDoc(grant('gestor'), { revokedAt: new Date() }));
  });

  it('ninguém apaga um acesso ATIVO — tirá-lo de uso é revogar, e revogar é da callable', async () => {
    await assertFails(deleteDoc(grant('dela')));
    await assertFails(deleteDoc(grant('gestor')));
  });

  // O administrador global passa por cima da LEITURA, como em todo o resto do produto — e continua
  // sem escrever, porque a trava aqui não é de permissão: é de quem sorteia o segredo.
  it('o administrador global lê e não escreve', async () => {
    await assertSucceeds(getDoc(grant('sistema')));
    await assertFails(updateDoc(grant('sistema'), { revokedAt: new Date() }));
  });
});

describe('exclusão — só do que já não autentica', () => {
  const seedInactive = (fields: Record<string, unknown>) => seed(env, {
    owners: { [TENANT]: 'dono' },
    records: {
      [TENANT]: {
        'agentGrants/dela1': {
          userId: 'dela',
          name: 'Claude no terminal',
          permissions: ['clientes.read'],
          secretHash: 'a'.repeat(64),
          expiresAt: null,
          revokedAt: null,
          ...fields,
        },
      },
    },
  });

  it('o dono apaga o seu depois de revogado', async () => {
    await seedInactive({ revokedAt: new Date() });
    await assertSucceeds(deleteDoc(grant('dela')));
  });

  it('o dono apaga o seu depois de vencido', async () => {
    await seedInactive({ expiresAt: new Date(Date.now() - 60_000) });
    await assertSucceeds(deleteDoc(grant('dela')));
  });

  it('quem tem agent.manage apaga o inativo de outro', async () => {
    await seedInactive({ revokedAt: new Date() });
    await assertSucceeds(deleteDoc(grant('gestor')));
  });

  it('um membro qualquer NÃO apaga o inativo de outro', async () => {
    await seedInactive({ revokedAt: new Date() });
    await assertFails(deleteDoc(grant('dele')));
  });

  // O token curto do OAuth vence a cada hora e o refresh o renova: apagá-lo por isso derrubaria um
  // consentimento que continua valendo, sem passar pela revogação.
  it('o token curto do OAuth vencido não torna o acesso apagável', async () => {
    await seedInactive({
      origin: 'oauth',
      accessExpiresAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await assertFails(deleteDoc(grant('dela')));
  });

  it('a validade futura não torna o acesso apagável', async () => {
    await seedInactive({ expiresAt: new Date(Date.now() + 86_400_000) });
    await assertFails(deleteDoc(grant('dela')));
  });
});

describe('a coleção é reservada', () => {
  // `agentGrants` está em `RESERVED_COLLECTIONS`, então ela NÃO passa pelo curinga das telas — que é
  // o que impediria alguém de criar uma tela chamada `agentGrants` e gravar por ali.
  it('não é alcançável pelo curinga de registros, mesmo com a permissão derivada', async () => {
    await seed(env, {
      users: { espertinho: {} },
      owners: { [TENANT]: 'dono' },
      members: { [TENANT]: { espertinho: ['agentGrants.create', 'agentGrants.read'] } },
      screens: { [TENANT]: { agentGrants: { id: 'agentGrants', origin: 'design' } } },
    });

    await assertFails(setDoc(doc(asUser(env, 'espertinho'), `tenants/${TENANT}/agentGrants/burlado`), {
      userId: 'espertinho',
      secretHash: 'd'.repeat(64),
      permissions: ['*'],
    }));
  });
});
