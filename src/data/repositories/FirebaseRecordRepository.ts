import { RECORD_CREATED_VIA_FIELD, RECORD_UPDATED_VIA_FIELD } from '../../domain/schema/mutationSpec';
import type { RecordWriteVia } from '../../domain/schema/mutationSpec';
import {
  addDoc,
  collection as firestoreCollection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import { RECORD_WINDOW_DEFAULT } from '../../domain/repositories/IRecordRepository';
import type { IRecordRepository } from '../../domain/repositories/IRecordRepository';
import type { EntityRecord, EntityRecordValues } from '../../domain/entities/EntityRecord';
import type { DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { toPlainValues } from '../utils/plainValues';
import type { RecordKeyConflict } from '../utils/recordRulesGate';
import {
  applyRecordRules,
  editWindowFor,
  EditWindowClosedError,
  loadRecordBaseline,
  makeRecordDeriver,
  planRecordKeysFor,
  RecordKeyConflictError,
  RecordKeyMissingError,
  RecordSequenceParentMissingError,
  recordSequencesFor,
  tableHasRecordKeys,
} from '../utils/recordRulesGate';
import type { RecordKeyEntry } from '../../domain/schema/recordKeys';
import { changedRecordKeys, editWindowAllowsDelete, editWindowAllowsUpdate } from '../../domain/schema/editWindow';
import { memberVisibilityClauses } from '../../domain/schema/memberVisibility';
import type { MemberVisibilityFilter } from '../../domain/schema/memberVisibility';
import {
  diffRecordKeys,
  recordKeyRefs,
  RECORD_KEY_REFS_FIELD,
  RECORD_KEYS_COLLECTION,
  storedRecordKeyRefs,
} from '../../domain/schema/recordKeys';
import { omitSequenceFields, planRecordSequences } from '../../domain/schema/recordSequence';
import {
  matchesSearchTerms,
  pickServerSearchTerm,
  RECORD_SEARCH_FIELD,
  RECORD_SEARCH_MAX_RESULTS,
  RECORD_SEARCH_WINDOW,
  searchQueryTerms,
} from '../../domain/schema/recordSearch';
import { runRecordSequenceTransaction } from '../utils/recordSequenceTransaction';
import { ambientTimeZone } from '../../domain/schema/clockGate';


/** O teto do operador `in` do Firestore. */
const IN_QUERY_LIMIT = 30;

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const recordsRef = (tenantId: string, collection: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection);

const keysRef = (tenantId: string) => firestoreCollection(db, 'tenants', tenantId, RECORD_KEYS_COLLECTION);

/**
 * A consulta da listagem. Para quem a visibilidade por registro restringe, ela leva o filtro que a
 * regra prova — um `==` e um `array-contains` por campo, num `or()` — e perde o `orderBy`: ordenar pelo
 * servidor pediria um índice composto por disjunção, por campo declarado, e a tela do Form Design não
 * tem como declarar índice. A ordem volta em memória (`newestFirst`), sobre o que a pessoa vê — e o
 * teto da janela vale para o que a NOMEIA, não para a coleção.
 *
 * `null` quando a declaração não nomeia campo nenhum (malformada): não há consulta que a regra aceite,
 * e a pessoa não vê nada.
 */
const listQuery = (
  tenantId: string,
  collection: string,
  visibleTo: MemberVisibilityFilter | null | undefined,
  max: number,
): Query | null => {
  if (!visibleTo) return query(recordsRef(tenantId, collection), orderBy('createdAt', 'desc'), limit(max));
  const clauses = memberVisibilityClauses(visibleTo.spec);
  if (clauses.length === 0) return null;
  return query(
    recordsRef(tenantId, collection),
    or(...clauses.map((clause) => where(clause.field, clause.op, visibleTo.uid))),
    limit(max),
  );
};

const createdMillis = (record: EntityRecord): number =>
  record.createdAt instanceof Date && !Number.isNaN(record.createdAt.getTime()) ? record.createdAt.getTime() : 0;

const newestFirst = (records: EntityRecord[]): EntityRecord[] =>
  [...records].sort((left, right) => createdMillis(right) - createdMillis(left));

const isPermissionDenied = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'permission-denied';

/**
 * A GARANTIA está aqui, e ela não é um `read-then-write`.
 *
 * A reserva entra no lote com `setDoc`, e a regra da coleção `recordKeys` só libera `create` — que
 * no Firestore só dispara quando o documento NÃO existe. Escrever sobre uma reserva ocupada é, para
 * a regra, um `update`, e é negado: o lote inteiro falha, atomicamente. Não há janela entre conferir
 * e gravar, e por isso duas gravações no mesmo instante não passam as duas. É o mesmo mecanismo de
 * `/nicknames`, que já vivia no repositório para um caso só.
 *
 * Nada disso pede índice composto: a busca é por id de documento. Foi a razão de preferir a reserva
 * a "consultar antes de gravar", que além de ter corrida obrigaria um índice por chave declarada.
 */
const keyDoc = (tenantId: string, keyId: string) => doc(keysRef(tenantId), keyId);

const reservationData = (collection: string, recordId: string, entry: RecordKeyEntry) => ({
  collection,
  keyName: entry.name,
  recordId,
  values: entry.values,
  createdAt: serverTimestamp(),
});

/**
 * A recusa do lote chega como `permission-denied`, e ela tem DUAS causas possíveis: a reserva já
 * existe (duplicata) ou quem grava não tem a permissão da coleção. Traduzir a segunda como "valor
 * repetido" mandaria a pessoa corrigir um campo que está certo, então a distinção é comprada com
 * uma leitura — e só no caminho de falha, que é onde ela cabe.
 */
const describeDenial = async (
  tenantId: string,
  collection: string,
  recordId: string | null,
  entries: RecordKeyEntry[],
  error: unknown,
): Promise<never> => {
  if ((error as { code?: string } | null)?.code !== 'permission-denied' || entries.length === 0) {
    throw error as Error;
  }
  const taken: RecordKeyConflict[] = [];
  for (const entry of entries) {
    const snap = await getDoc(keyDoc(tenantId, entry.keyId));
    if (!snap.exists()) continue;
    if (recordId !== null && (snap.data() as { recordId?: string }).recordId === recordId) continue;
    taken.push({
      name: entry.name,
      fields: entry.fields,
      values: entry.values,
      ...(entry.message ? { message: entry.message } : {}),
    });
  }
  if (taken.length === 0) throw error as Error;
  throw new RecordKeyConflictError(collection, taken);
};

/**
 * Os campos vêm da raiz do documento, sem desempacotamento. `tenantId` e `collection` são de
 * memória — reconstruídos do caminho lido, nunca gravados.
 *
 * `derive` é o portão de LEITURA (`makeRecordDeriver`), montado uma vez por leitura e não por
 * documento: é aqui que os campos `logic.derive` ganham valor. Sendo este o único ponto por onde um
 * registro entra no front, tudo o que vem depois — lista, card, filtro, ordenação, expressão de
 * ação — os enxerga como enxerga qualquer campo gravado.
 */
/**
 * Os termos de busca ficam no servidor. Trazê-los pesaria centenas de textos por registro na
 * memória, e um registro duplicado a partir de outro os levaria de volta numa gravação que a regra
 * recusa — o campo é do backend.
 */
const withoutSearchTerms = (values: Record<string, unknown>): Record<string, unknown> => {
  if (!(RECORD_SEARCH_FIELD in values)) return values;
  const copy = { ...values };
  delete copy[RECORD_SEARCH_FIELD];
  return copy;
};

const mapRecord = (
  id: string,
  d: Record<string, unknown>,
  tenantId: string,
  collection: string,
  derive: <T extends object>(record: T) => T,
): EntityRecord => derive({
  ...withoutSearchTerms(toPlainValues(d) as Record<string, unknown>),
  id,
  tenantId,
  collection,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  createdByName: d.createdByName as string | undefined,
  createdByPhotoURL: d.createdByPhotoURL as string | undefined,
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
  createdVia: d.createdVia as RecordWriteVia | undefined,
  updatedVia: d.updatedVia as RecordWriteVia | undefined,
});

/**
 * Toda gravação deste repositório é a de uma pessoa no app. O carimbo é dele, e não de quem chama,
 * porque é ele o único ponto por onde um registro sai do front — e a regra do Firestore recusa
 * qualquer outro valor vindo do cliente, de modo que ninguém se passa por agente ou automação.
 */
const RECORD_VIA_UI: RecordWriteVia = 'ui';

/** Metadados de memória nunca chegam ao Firestore. */
const stripIdentity = (data: EntityRecordValues): Record<string, unknown> => {
  const { id, tenantId, collection, createdAt, updatedAt, ...rest } = data as Record<string, unknown>;
  void id;
  void tenantId;
  void collection;
  void createdAt;
  void updatedAt;
  return withoutSearchTerms(rest);
};

export class FirebaseRecordRepository implements IRecordRepository {
  async getAll(tenantId: string, collection: string): Promise<EntityRecord[]> {
    const q = query(recordsRef(tenantId, collection), orderBy('createdAt', 'desc'), limit(RECORD_WINDOW_DEFAULT));
    const snap = await getDocs(q);
    const derive = makeRecordDeriver(collection);
    return snap.docs.map((d) => mapRecord(d.id, d.data(), tenantId, collection, derive));
  }

  subscribe(
    tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
    onError?: (collection: string, error: Error) => void,
    visibleTo?: MemberVisibilityFilter | null,
    max: number = RECORD_WINDOW_DEFAULT,
  ): () => void {
    const q = listQuery(tenantId, collection, visibleTo, max);
    if (q === null) {
      onUpdate([]);
      return () => undefined;
    }
    return onSnapshot(
      q,
      (snap) => {
        // O instante nasce a cada snapshot: a lista se refaz quando o dado muda e quando o Store
        // relê ao voltar o foco, e é aí que o valor derivado volta a falar do momento presente.
        const derive = makeRecordDeriver(collection);
        const records = snap.docs.map((d) => mapRecord(d.id, d.data(), tenantId, collection, derive));
        onUpdate(visibleTo ? newestFirst(records) : records);
      },
      (error) => {
        console.error(`[RecordRepository] subscribe ${collection}:`, error.message);
        onError?.(collection, error);
      },
    );
  }

  async getById(tenantId: string, collection: string, recordId: string): Promise<EntityRecord | null> {
    const snap = await getDoc(doc(recordsRef(tenantId, collection), recordId));
    if (!snap.exists()) return null;
    return mapRecord(snap.id, snap.data(), tenantId, collection, makeRecordDeriver(collection));
  }

  async getByIds(
    tenantId: string,
    collection: string,
    ids: readonly string[],
    visibleTo?: MemberVisibilityFilter | null,
  ): Promise<EntityRecord[]> {
    const unique = [...new Set(ids.filter((id) => id !== ''))];
    if (unique.length === 0) return [];
    const derive = makeRecordDeriver(collection);
    // A consulta por `in` não carrega o filtro de visibilidade, e a regra recusaria o lote inteiro
    // por um registro só que a pessoa não vê. Restrita, ela lê um a um, e cada recusa só tira aquele.
    if (visibleTo) {
      const snaps = await Promise.all(unique.map(async (id) => {
        try {
          return await getDoc(doc(recordsRef(tenantId, collection), id));
        } catch (error) {
          if (isPermissionDenied(error)) return null;
          throw error;
        }
      }));
      return snaps.flatMap((snap) =>
        snap && snap.exists() ? [mapRecord(snap.id, snap.data(), tenantId, collection, derive)] : []);
    }
    const found: EntityRecord[] = [];
    for (let start = 0; start < unique.length; start += IN_QUERY_LIMIT) {
      const part = unique.slice(start, start + IN_QUERY_LIMIT);
      const snap = await getDocs(query(recordsRef(tenantId, collection), where(documentId(), 'in', part)));
      for (const d of snap.docs) found.push(mapRecord(d.id, d.data(), tenantId, collection, derive));
    }
    return found;
  }

  async search(
    tenantId: string,
    collection: string,
    text: string,
    max: number,
    visibleTo?: MemberVisibilityFilter | null,
  ): Promise<EntityRecord[]> {
    const terms = searchQueryTerms(text);
    const term = pickServerSearchTerm(terms);
    if (!term) return [];
    const cap = Math.min(Math.max(max, 1), RECORD_SEARCH_MAX_RESULTS);
    if (visibleTo) {
      const call = httpsCallable<
        { tenantId: string; collection: string; query: string; limit: number },
        { ids: string[] }
      >(functions, 'searchRecords');
      const { data } = await call({ tenantId, collection, query: text, limit: cap });
      const byId = new Map((await this.getByIds(tenantId, collection, data.ids, visibleTo)).map((record) => [record.id, record]));
      return data.ids.flatMap((id) => byId.get(id) ?? []);
    }
    const snap = await getDocs(query(
      recordsRef(tenantId, collection),
      where(RECORD_SEARCH_FIELD, 'array-contains', term),
      limit(RECORD_SEARCH_WINDOW),
    ));
    const derive = makeRecordDeriver(collection);
    // As palavras que não foram ao servidor são conferidas sobre os termos CRUS — o registro mapeado
    // já não os traz.
    const matched = snap.docs
      .filter((d) => matchesSearchTerms(d.data()[RECORD_SEARCH_FIELD], terms))
      .map((d) => mapRecord(d.id, d.data(), tenantId, collection, derive));
    return newestFirst(matched).slice(0, cap);
  }

  newId(tenantId: string, collection: string): string {
    return doc(recordsRef(tenantId, collection)).id;
  }

  async create(
    tenantId: string,
    collection: string,
    data: EntityRecordValues,
    recordId?: string,
  ): Promise<EntityRecord> {
    const sequences = recordSequencesFor(collection);
    const ruled = applyRecordRules(collection, omitSequenceFields(stripIdentity(data), sequences));
    const plan = planRecordKeysFor(collection, ruled);
    if (plan.gaps.length > 0) throw new RecordKeyMissingError(collection, plan.gaps);

    const payload = {
      ...ruled,
      ...(plan.entries.length > 0 ? { [RECORD_KEY_REFS_FIELD]: recordKeyRefs(plan.entries) } : {}),
      [RECORD_CREATED_VIA_FIELD]: RECORD_VIA_UI,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (sequences.length > 0) {
      const numbering = planRecordSequences(sequences, ruled, collection, new Date(), ambientTimeZone());
      if (numbering.gaps.length > 0) throw new RecordSequenceParentMissingError(numbering.gaps);
      const id = recordId ?? this.newId(tenantId, collection);
      let assigned: Record<string, unknown> = {};
      try {
        assigned = await runRecordSequenceTransaction(db, tenantId, numbering.entries, (tx, values) => {
          tx.set(doc(recordsRef(tenantId, collection), id), { ...payload, ...values });
          for (const entry of plan.entries) tx.set(keyDoc(tenantId, entry.keyId), reservationData(collection, id, entry));
        });
      } catch (error) {
        await describeDenial(tenantId, collection, id, plan.entries, error);
      }
      return this.readBack(tenantId, collection, id, { ...ruled, ...assigned });
    }

    // Com id em mãos o documento nasce onde os arquivos dele já foram gravados; sem, o Firestore
    // sorteia como sempre. Uma coleção COM chave sempre tem id antes do lote: a reserva precisa
    // apontar para o registro, e `addDoc` só devolve o id depois de gravar.
    if (plan.entries.length === 0) {
      let ref;
      if (recordId) {
        ref = doc(recordsRef(tenantId, collection), recordId);
        await setDoc(ref, payload);
      } else {
        ref = await addDoc(recordsRef(tenantId, collection), payload);
      }
      return this.readBack(tenantId, collection, ref.id, ruled);
    }

    const id = recordId ?? this.newId(tenantId, collection);
    const batch = writeBatch(db);
    batch.set(doc(recordsRef(tenantId, collection), id), payload);
    for (const entry of plan.entries) batch.set(keyDoc(tenantId, entry.keyId), reservationData(collection, id, entry));
    try {
      await batch.commit();
    } catch (error) {
      await describeDenial(tenantId, collection, id, plan.entries, error);
    }
    return this.readBack(tenantId, collection, id, ruled);
  }

  /**
   * O registro como ficou gravado. Numa tela com visibilidade por registro, quem cria pode nomear
   * OUTRA pessoa — é o encaminhamento —, e a releitura é recusada: o registro existe, só não é dele.
   * Ali a resposta é o que foi enviado, com o relógio local no lugar do do servidor.
   */
  private async readBack(
    tenantId: string,
    collection: string,
    id: string,
    sent: Record<string, unknown>,
  ): Promise<EntityRecord> {
    const ref = doc(recordsRef(tenantId, collection), id);
    const derive = makeRecordDeriver(collection);
    try {
      const snap = await getDoc(ref);
      return mapRecord(id, snap.data() as Record<string, unknown>, tenantId, collection, derive);
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      const now = new Date();
      return mapRecord(id, { ...sent, createdAt: now, updatedAt: now }, tenantId, collection, derive);
    }
  }

  async update(
    tenantId: string,
    collection: string,
    recordId: string,
    data: EntityRecordValues,
  ): Promise<void> {
    const hasKeys = tableHasRecordKeys(collection);
    const editWindow = editWindowFor(collection);
    // A coleção com chave precisa do registro inteiro de qualquer jeito: uma chave composta cujo
    // update toca um campo só continua sendo a mesma chave, e planejar sobre o payload parcial
    // reservaria metade dos valores vazios. A janela de edição também: ela pergunta o que MUDA, e
    // quando o registro nasceu.
    const baseline = hasKeys || editWindow
      ? await this.readRaw(tenantId, collection, recordId)
      : await loadRecordBaseline(collection, doc(recordsRef(tenantId, collection), recordId));
    // O número atribuído na criação não muda depois: o formulário reenvia o registro inteiro, e o
    // valor que vem nele — igual ou não — nunca chega ao banco.
    const ruled = applyRecordRules(
      collection,
      omitSequenceFields(stripIdentity(data), recordSequencesFor(collection)),
      baseline,
    );

    if (editWindow && baseline) {
      const allowed = editWindowAllowsUpdate(editWindow.spec, baseline.createdAt, new Date(), {
        changedKeys: changedRecordKeys(baseline, ruled as Record<string, unknown>),
        memberWritableFields: editWindow.memberWritableFields,
      });
      if (!allowed) throw new EditWindowClosedError(editWindow.spec.minutes, 'update');
    }

    if (!hasKeys) {
      await updateDoc(doc(recordsRef(tenantId, collection), recordId), {
        ...ruled,
        [RECORD_UPDATED_VIA_FIELD]: RECORD_VIA_UI,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const plan = planRecordKeysFor(collection, ruled, baseline);
    if (plan.gaps.length > 0) throw new RecordKeyMissingError(collection, plan.gaps);
    const diff = diffRecordKeys(plan, storedRecordKeyRefs(baseline));

    const batch = writeBatch(db);
    batch.update(doc(recordsRef(tenantId, collection), recordId), {
      ...ruled,
      [RECORD_KEY_REFS_FIELD]: diff.refs,
      [RECORD_UPDATED_VIA_FIELD]: RECORD_VIA_UI,
      updatedAt: serverTimestamp(),
    });
    // Soltar antes de criar é o que permite trocar o valor de uma chave e voltar atrás na mesma
    // sessão. A reserva cujo valor NÃO mudou não é solta nem recriada: sair e voltar abriria uma
    // janela em que o valor está livre para outro registro.
    for (const keyId of diff.release) batch.delete(keyDoc(tenantId, keyId));
    for (const entry of diff.create) batch.set(keyDoc(tenantId, entry.keyId), reservationData(collection, recordId, entry));
    try {
      await batch.commit();
    } catch (error) {
      await describeDenial(tenantId, collection, recordId, diff.create, error);
    }
  }

  private async readRaw(
    tenantId: string,
    collection: string,
    recordId: string,
  ): Promise<Record<string, unknown> | undefined> {
    const snap = await getDoc(doc(recordsRef(tenantId, collection), recordId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
  }

  /**
   * Recusa a exclusão que a janela de edição trava, ANTES de qualquer escrita. Existe separado de
   * `delete` porque a cascata do caso de uso apaga anotações e documentos primeiro: conferir só no
   * fim deixaria a prova sem os anexos dela.
   */
  async ensureDeletable(tenantId: string, collection: string, recordId: string): Promise<void> {
    const editWindow = editWindowFor(collection);
    if (!editWindow || editWindow.spec.delete !== true) return;
    const raw = await this.readRaw(tenantId, collection, recordId);
    if (raw && !editWindowAllowsDelete(editWindow.spec, raw.createdAt, new Date())) {
      throw new EditWindowClosedError(editWindow.spec.minutes, 'delete');
    }
  }

  async delete(
    tenantId: string,
    collection: string,
    recordId: string,
    actor: DeletionActor,
  ): Promise<void> {
    await this.ensureDeletable(tenantId, collection, recordId);
    const ref = doc(recordsRef(tenantId, collection), recordId);
    await stampDeletionActor(ref, actor);
    if (!tableHasRecordKeys(collection)) {
      await deleteDoc(ref);
      return;
    }
    // As reservas saem no MESMO lote do registro: soltas antes, o valor ficaria livre enquanto o
    // registro ainda existe; soltas depois, uma falha entre as duas escritas prenderia o valor para
    // sempre num registro que não está mais lá.
    const refs = storedRecordKeyRefs(await this.readRaw(tenantId, collection, recordId));
    const batch = writeBatch(db);
    batch.delete(ref);
    for (const keyId of Object.values(refs)) batch.delete(keyDoc(tenantId, keyId));
    await batch.commit();
  }

  /**
   * Numa tela com visibilidade por registro, quem não supervisiona não tem como saber se a coleção está
   * vazia — a consulta sem filtro é recusada. A resposta, então, é SIM: quem pergunta isto é a exclusão
   * da tela, e excluir a tela de uma coleção que talvez tenha registros é o que ela existe para impedir.
   */
  async hasRecords(tenantId: string, collection: string): Promise<boolean> {
    try {
      const snap = await getDocs(query(recordsRef(tenantId, collection), limit(1)));
      return !snap.empty;
    } catch (error) {
      if (isPermissionDenied(error)) return true;
      throw error;
    }
  }
}
