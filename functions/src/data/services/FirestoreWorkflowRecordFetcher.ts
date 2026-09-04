import type { Firestore } from 'firebase-admin/firestore';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

/**
 * O tamanho do LOTE de `getAll`.
 *
 * Existe porque a busca passou a servir também o relatório: com 2000 linhas e uma referência, um
 * `getAll` único receberia 2000 refs de uma vez — acima do que o gRPC aceita com folga, e a falha
 * seria da chamada inteira. O lote é melhoria pura, e vale igual para os fluxos.
 */
const FETCH_CHUNK_SIZE = 300;

const chunked = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export class FirestoreWorkflowRecordFetcher implements IWorkflowRecordFetcher {
  constructor(private readonly db: Firestore) {}

  async fetchByIds(
    tenantId: string,
    collection: string,
    ids: string[],
  ): Promise<Map<string, Record<string, unknown> | null>> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return new Map();

    const batches = await Promise.all(
      chunked(uniqueIds, FETCH_CHUNK_SIZE).map((batch) => this.db.getAll(
        ...batch.map((id) => this.db.doc(`tenants/${tenantId}/${collection}/${id}`)),
      )),
    );

    return new Map(
      batches.flat().map((snapshot, index) => [
        uniqueIds[index],
        snapshot.exists ? normalizeFirestoreValue(snapshot.data() as Record<string, unknown>) : null,
      ]),
    );
  }
}
