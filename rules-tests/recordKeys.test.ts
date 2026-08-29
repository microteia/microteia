import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O bloco `recordKeys`, exercitado contra o arquivo REAL de regras — que é o único lugar onde a
 * garantia da unicidade pode ser provada.
 *
 * A propriedade que interessa é uma só e é sutil: a coleção libera `create` e NÃO libera `update`.
 * No Firestore, `create` só dispara quando o documento não existe, então gravar sobre uma reserva
 * ocupada é negado — e, dentro de um lote, a negação derruba o lote inteiro. É isso que faz duas
 * gravações no mesmo instante não passarem as duas, sem nenhum "conferir antes de gravar".
 */
let env: RulesTestEnvironment;

const SCREEN = { titleSingular: 'Produto', titlePlural: 'Produtos', fields: [] };

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { escritor: {}, leitor: {}, faxineiro: {}, forasteiro: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outro-dono' },
    members: {
      [TENANT]: {
        escritor: ['prod.read', 'prod.create', 'prod.update'],
        leitor: ['prod.read'],
        faxineiro: ['prod.read', 'prod.delete'],
      },
      [OTHER_TENANT]: { forasteiro: ['prod.read', 'prod.create'] },
    },
    screens: { [TENANT]: { prod: SCREEN } },
  });
});

const keyPath = (id: string) => `tenants/${TENANT}/recordKeys/${id}`;
const keyDoc = (uid: string, id: string) => doc(asUser(env, uid), keyPath(id));
const reservation = (recordId = 'r1', keyName = 'sku', values = ['AB-1']) => ({
  collection: 'prod',
  keyName,
  recordId,
  values,
  createdAt: new Date(),
});

describe('criar uma reserva', () => {
  it('quem grava na coleção reserva', async () => {
    await assertSucceeds(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation()));
  });

  it('quem só LÊ a coleção não reserva', async () => {
    await assertFails(setDoc(keyDoc('leitor', 'prod|sku|AB-1'), reservation()));
  });

  it('quem não é do escritório não reserva', async () => {
    await assertFails(setDoc(keyDoc('forasteiro', 'prod|sku|AB-1'), reservation()));
  });

  it('não se reserva para uma coleção que não é tela declarada', async () => {
    await assertFails(setDoc(
      keyDoc('escritor', 'inventada|sku|AB-1'),
      { ...reservation(), collection: 'inventada' },
    ));
  });

  it('a reserva não carrega campo além dos seus — o documento não é depósito de dado', async () => {
    await assertFails(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), { ...reservation(), extra: 1 }));
  });

  it('a reserva sem os campos que a identificam é recusada', async () => {
    await assertFails(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), { collection: 'prod' }));
    await assertFails(setDoc(
      keyDoc('escritor', 'prod|sku|AB-1'),
      { ...reservation(), recordId: 42 },
    ));
    await assertFails(setDoc(
      keyDoc('escritor', 'prod|sku|AB-1'),
      { ...reservation(), values: 'AB-1' },
    ));
  });
});

describe('a trava — reserva ocupada não se sobrescreve', () => {
  beforeEach(async () => {
    await setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r1'));
  });

  it('ninguém escreve por cima de uma reserva que já existe', async () => {
    await assertFails(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r2')));
  });

  it('nem o próprio dono da reserva a reescreve — não há `update` nesta coleção', async () => {
    await assertFails(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r1')));
  });

  it('o LOTE inteiro cai junto: o registro não nasce quando a reserva é recusada', async () => {
    const db = asUser(env, 'escritor');
    const batch = writeBatch(db);
    batch.set(doc(db, `tenants/${TENANT}/prod/r2`), { sku: 'AB-1', keyRefs: { sku: 'prod|sku|AB-1' } });
    batch.set(doc(db, keyPath('prod|sku|AB-1')), reservation('r2'));
    await assertFails(batch.commit());
    // E é isto que prova a atomicidade: o registro não ficou para trás.
    await env.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), `tenants/${TENANT}/prod/r2`));
      if (snap.exists()) throw new Error('o registro foi gravado apesar de a reserva ter falhado');
    });
  });

  it('o lote com um valor LIVRE passa inteiro', async () => {
    const db = asUser(env, 'escritor');
    const batch = writeBatch(db);
    batch.set(doc(db, `tenants/${TENANT}/prod/r2`), { sku: 'AB-2', keyRefs: { sku: 'prod|sku|AB-2' } });
    batch.set(doc(db, keyPath('prod|sku|AB-2')), reservation('r2', 'sku', ['AB-2']));
    await assertSucceeds(batch.commit());
  });
});

describe('soltar uma reserva', () => {
  beforeEach(async () => {
    await setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r1'));
  });

  it('quem altera a coleção solta — é o que faz trocar de valor ser possível', async () => {
    await assertSucceeds(deleteDoc(keyDoc('escritor', 'prod|sku|AB-1')));
  });

  it('quem exclui na coleção solta — é o que faz apagar o registro liberar o valor', async () => {
    await assertSucceeds(deleteDoc(keyDoc('faxineiro', 'prod|sku|AB-1')));
  });

  it('quem só lê não solta', async () => {
    await assertFails(deleteDoc(keyDoc('leitor', 'prod|sku|AB-1')));
  });

  it('quem é de outro escritório não solta', async () => {
    await assertFails(deleteDoc(keyDoc('forasteiro', 'prod|sku|AB-1')));
  });

  it('solto, o valor volta a ser reservável', async () => {
    await deleteDoc(keyDoc('escritor', 'prod|sku|AB-1'));
    await assertSucceeds(setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r2')));
  });
});

describe('ler uma reserva', () => {
  beforeEach(async () => {
    await setDoc(keyDoc('escritor', 'prod|sku|AB-1'), reservation('r1'));
  });

  /**
   * O front precisa ler para dizer QUAL valor colidiu: sem isso, o formulário só saberia repetir
   * "acesso negado" — e a pessoa procuraria o defeito na permissão, não no campo.
   */
  it('qualquer membro do escritório lê', async () => {
    await assertSucceeds(getDoc(keyDoc('leitor', 'prod|sku|AB-1')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(keyDoc('forasteiro', 'prod|sku|AB-1')));
  });
});

describe('a coleção das reservas não é uma tela', () => {
  it('o curinga de registros não a alcança — ela é reservada', async () => {
    // Uma gravação com a FORMA de registro (fora do contrato da reserva) é recusada: se o curinga
    // ainda a alcançasse, ela passaria pela permissão da coleção "recordKeys".
    await assertFails(setDoc(keyDoc('escritor', 'qualquer'), { nome: 'um registro comum' }));
  });
});
