import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';
import { runRecordSequenceTransaction } from '../src/data/utils/recordSequenceTransaction';
import { planRecordSequences } from '../src/domain/schema/recordSequence';

/**
 * O bloco `recordSequences`, exercitado contra o arquivo REAL de regras.
 *
 * Duas garantias, e as duas só se provam aqui:
 *
 * - a TRANSAÇÃO do cliente — a mesma forma que `FirebaseRecordRepository.create` usa — dá números
 *   distintos e contíguos a gravações concorrentes, vindas de navegadores diferentes;
 * - a REGRA impede qualquer cliente, inclusive um que não use transação, de fazer o contador repetir
 *   um número já dado: ele nasce em 1, avança exatamente um, não recua, não se apaga, e não troca de
 *   coleção.
 */
let env: RulesTestEnvironment;

const SCREEN = { titleSingular: 'Comunicação', titlePlural: 'Comunicações', fields: [] };
const YEAR = String(new Date().getUTCFullYear());
const ID = `prod|protocolo||${YEAR}`;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { escritor: {}, escritora: {}, leitor: {}, vizinho: {}, forasteiro: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outro-dono' },
    members: {
      [TENANT]: {
        escritor: ['prod.read', 'prod.create', 'prod.update'],
        escritora: ['prod.read', 'prod.create'],
        leitor: ['prod.read'],
        vizinho: ['outra.read', 'outra.create'],
      },
      [OTHER_TENANT]: { forasteiro: ['prod.read', 'prod.create'] },
    },
    screens: { [TENANT]: { prod: SCREEN, outra: SCREEN } },
  });
});

const counterPath = (id: string) => `tenants/${TENANT}/recordSequences/${id}`;
const counterDoc = (uid: string, id = ID) => doc(asUser(env, uid), counterPath(id));
const counter = (value: number, extra: Record<string, unknown> = {}) => ({
  collection: 'prod',
  field: 'protocolo',
  parent: '',
  period: YEAR,
  value,
  updatedAt: new Date(),
  ...extra,
});

const seedCounter = (value: number, id = ID, data = counter(value)) =>
  env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, counterPath(id)), data);
  });

describe('o contador nasce', () => {
  it('em 1, por quem cria na coleção', async () => {
    await assertSucceeds(setDoc(counterDoc('escritor'), counter(1)));
  });

  it('nunca em outro número — nascer adiantado seria saltar, nascer em 0 repetiria o 1', async () => {
    await assertFails(setDoc(counterDoc('escritor'), counter(5)));
    await assertFails(setDoc(counterDoc('escritor'), counter(0)));
  });

  it('não por quem só lê a coleção, nem por quem é de outro escritório', async () => {
    await assertFails(setDoc(counterDoc('leitor'), counter(1)));
    await assertFails(setDoc(counterDoc('forasteiro'), counter(1)));
  });

  it('não para uma coleção que não é tela declarada', async () => {
    const id = `inventada|protocolo||${YEAR}`;
    await assertFails(setDoc(counterDoc('escritor', id), counter(1, { collection: 'inventada' })));
  });

  it('não sob o id do contador de OUTRA coleção — onde a permissão conferida seria a errada', async () => {
    await assertFails(setDoc(counterDoc('vizinho', ID), counter(1, { collection: 'outra' })));
  });

  it('não com campo além dos seus, nem com valor que não seja inteiro', async () => {
    await assertFails(setDoc(counterDoc('escritor'), counter(1, { extra: true })));
    await assertFails(setDoc(counterDoc('escritor'), counter(1.5)));
  });

  it('não num período que não é o ano corrente', async () => {
    const id = 'prod|protocolo||2019';
    await assertFails(setDoc(counterDoc('escritor', id), counter(1, { period: '2019' })));
  });

  it('sem período, quando a sequência nunca recomeça', async () => {
    await assertSucceeds(setDoc(counterDoc('escritor', 'prod|protocolo||'), counter(1, { period: '' })));
  });
});

describe('o contador avança', () => {
  beforeEach(async () => { await seedCounter(3); });

  it('exatamente um', async () => {
    await assertSucceeds(setDoc(counterDoc('escritora'), counter(4)));
  });

  it('nunca dois, nunca zero, nunca para trás', async () => {
    await assertFails(setDoc(counterDoc('escritor'), counter(5)));
    await assertFails(setDoc(counterDoc('escritor'), counter(3)));
    await assertFails(setDoc(counterDoc('escritor'), counter(1)));
  });

  it('sem mudar de coleção, campo, pai ou período', async () => {
    await assertFails(setDoc(counterDoc('escritor'), counter(4, { parent: 'p1' })));
    await assertFails(setDoc(counterDoc('escritor'), counter(4, { field: 'outro' })));
  });

  it('e nunca é apagado — apagá-lo o faria recomeçar do 1', async () => {
    await assertFails(deleteDoc(counterDoc('escritor')));
  });

  it('quem leu um valor velho não grava por cima: o número dele já foi dado', async () => {
    await assertSucceeds(setDoc(counterDoc('escritora'), counter(4)));
    await assertFails(setDoc(counterDoc('escritor'), counter(4)));
  });
});

describe('quem lê o contador', () => {
  it('quem cria na coleção lê; quem só lê a coleção, não', async () => {
    await seedCounter(3);
    await assertSucceeds(getDoc(counterDoc('escritor')));
    await assertFails(getDoc(counterDoc('leitor')));
  });

  it('o contador que ainda não existe é lido por quem é do escritório — é a primeira gravação', async () => {
    await assertSucceeds(getDoc(counterDoc('escritor')));
    await assertFails(getDoc(counterDoc('forasteiro')));
  });
});

/**
 * A gravação numerada pelo MESMO código do repositório do front (`runRecordSequenceTransaction`):
 * lê o contador, avança um, grava o registro com o valor — e recomeça quando perde a corrida.
 */
const createNumbered = (db: Firestore, recordId: string) => {
  const { entries } = planRecordSequences(
    [{ key: 'protocolo', pattern: 'YYYY/000000', scope: 'tenant', resetBy: 'year', numeric: false, parentFieldKey: null }],
    {},
    'prod',
    new Date(),
    'UTC',
  );
  return runRecordSequenceTransaction(db, TENANT, entries, (tx, values) => {
    tx.set(doc(db, `tenants/${TENANT}/prod/${recordId}`), { assunto: recordId, ...values, createdVia: 'ui' });
  });
};

describe('a gravação numerada, em transação', () => {
  it('registro e contador entram juntos', async () => {
    await assertSucceeds(createNumbered(asUser(env, 'escritor'), 'r1'));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      expect((await getDoc(doc(db, counterPath(ID)))).data()?.value).toBe(1);
      expect((await getDoc(doc(db, `tenants/${TENANT}/prod/r1`))).data()?.protocolo).toBe(`${YEAR}/000001`);
    });
  });

  it('quando o registro é recusado, o contador não avança — não há lacuna por gravação recusada', async () => {
    await assertFails(createNumbered(asUser(env, 'leitor'), 'r1'));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      expect((await getDoc(doc(db, counterPath(ID)))).exists()).toBe(false);
    });
  });

  it('sob concorrência de navegadores diferentes, nenhum número se repete e nenhum é pulado', async () => {
    const total = 12;
    const writers = Array.from({ length: total }, (_, index) => asUser(env, index % 2 === 0 ? 'escritor' : 'escritora'));
    await Promise.all(writers.map((db, index) => createNumbered(db, `r${index}`)));

    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const records = await getDocs(collection(db, `tenants/${TENANT}/prod`));
      const numbers = records.docs.map((record) => record.data().protocolo as string).sort();
      expect(numbers).toEqual(
        Array.from({ length: total }, (_, index) => `${YEAR}/${String(index + 1).padStart(6, '0')}`),
      );
      expect((await getDoc(doc(db, counterPath(ID)))).data()?.value).toBe(total);
    });
  });
});
