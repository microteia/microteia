import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore, Transaction } from 'firebase/firestore';
import type { RecordSequenceEntry } from '../../domain/schema/recordSequence';
import {
  formatRecordSequenceValue,
  nextRecordSequenceValue,
  RECORD_SEQUENCES_COLLECTION,
  recordSequenceCounterData,
} from '../../domain/schema/recordSequence';

/**
 * Quantas vezes a gravação numerada recomeça depois de perder a corrida para outra. Cada derrota quer
 * dizer que OUTRO registro levou um número — há sempre progresso —, então o teto só é alcançado com
 * dezenas de criações no mesmo instante no mesmo contador, e aí a recusa chega à pessoa, que tenta de
 * novo.
 */
const MAX_ROUNDS = 30;

/**
 * A espera antes de recomeçar, sorteada e crescente: quem perdeu junto não volta junto, e a corrida
 * seguinte tem menos concorrentes que a anterior em vez de repetir a mesma.
 */
const BACKOFF_STEP_MS = 25;
const BACKOFF_MAX_MS = 400;

const backoff = (round: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.random() * Math.min(BACKOFF_MAX_MS, BACKOFF_STEP_MS * round));
  });

const counterRef = (db: Firestore, tenantId: string, counterId: string) =>
  doc(db, 'tenants', tenantId, RECORD_SEQUENCES_COLLECTION, counterId);

const isPermissionDenied = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'permission-denied';

/**
 * Algum contador andou desde que esta tentativa o leu? É o que separa a corrida perdida da recusa de
 * verdade (permissão, chave ocupada, janela de edição) — as duas chegam como `permission-denied`.
 * Uma releitura que falha não prova corrida nenhuma, e a recusa original segue.
 */
const countersMoved = async (
  db: Firestore,
  tenantId: string,
  entries: readonly RecordSequenceEntry[],
  observed: readonly unknown[],
): Promise<boolean> => {
  try {
    const snapshots = await Promise.all(entries.map((entry) => getDoc(counterRef(db, tenantId, entry.counterId))));
    return snapshots.some((snapshot, index) => snapshot.data()?.value !== observed[index]);
  } catch {
    return false;
  }
};

/**
 * A gravação de um registro numerado: lê os contadores, avança cada um em UM e entrega a `write` o
 * valor de cada campo, tudo numa transação só. A leitura entra na precondição do commit, e um
 * contador que outro registro avançou no meio do caminho derruba a tentativa — é isso, e não um "ler
 * e torcer", que impede dois registros de saírem com o mesmo número.
 *
 * A derrota chega de DUAS formas, e as duas recomeçam. O SDK repete sozinho a que vem como conflito
 * de precondição; mas o Firestore avalia a regra antes da precondição, e a regra do contador ("avança
 * exatamente um") recusa quem leu um valor velho como `permission-denied` — que o SDK não repete.
 * Essa é reconhecida aqui: o contador andou desde a leitura, então foi corrida, e se tenta de novo.
 *
 * Devolve o que foi atribuído. Não há lacuna por falha: o contador só avança se o registro é gravado.
 */
export const runRecordSequenceTransaction = async (
  db: Firestore,
  tenantId: string,
  entries: readonly RecordSequenceEntry[],
  write: (tx: Transaction, assigned: Record<string, unknown>) => void,
): Promise<Record<string, unknown>> => {
  for (let round = 1; ; round += 1) {
    let observed: unknown[] = [];
    try {
      return await runTransaction(db, async (tx) => {
        const refs = entries.map((entry) => counterRef(db, tenantId, entry.counterId));
        const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
        observed = snapshots.map((snapshot) => snapshot.data()?.value);
        const assigned: Record<string, unknown> = {};
        entries.forEach((entry, index) => {
          const value = nextRecordSequenceValue(observed[index]);
          assigned[entry.field] = formatRecordSequenceValue(entry, value);
          tx.set(refs[index], { ...recordSequenceCounterData(entry, value), updatedAt: serverTimestamp() });
        });
        write(tx, assigned);
        return assigned;
      });
    } catch (error) {
      const lostRace = round < MAX_ROUNDS
        && isPermissionDenied(error)
        && (await countersMoved(db, tenantId, entries, observed));
      if (!lostRace) throw error;
      await backoff(round);
    }
  }
};
