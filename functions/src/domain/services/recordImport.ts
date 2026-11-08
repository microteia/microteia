import type { RecordImportRow, RecordImportTotals, RecordImportStatus } from '../schema/recordImport';
import type { ScopedRecordKeySpec } from '../schema/recordKeys';
import { planRecordKeys } from '../schema/recordKeys';
import type { FieldRulePresetCatalog } from '../schema/fieldRulePresets';
import type { CreateAuditLogInput } from '../usecases/CreateAuditLogUseCase';

/** Quantas raias gravam ao mesmo tempo dentro de um lote. */
export const RECORD_IMPORT_CONCURRENCY = 8;

/**
 * As linhas que disputam a MESMA reserva de chave caem na mesma raia, e a raia grava em ordem.
 *
 * Duas linhas com a mesma chave `primary` em paralelo nasceriam as duas como "criar" — e a segunda
 * perderia a reserva com um conflito, quando o que ela pedia era alterar o registro que a primeira acabou
 * de criar. Em ordem, a segunda acha o registro e o altera, que é o que a importação reprocessada faz. O
 * mesmo vale para uma chave `unique`: em ordem, quem perde é sempre a linha de baixo, e o relatório não
 * muda de uma execução para outra.
 *
 * A raia sai do valor CRU normalizado pela chave (`normalize`), não do valor depois das regras do campo:
 * duas grafias que só as regras igualariam podem correr em paralelo, e a que perder diz `key-conflict` —
 * nunca uma duplicata, porque a reserva é a mesma.
 */
export const importLanes = (
  rows: readonly RecordImportRow[],
  keys: readonly ScopedRecordKeySpec[],
  collection: string,
  catalog?: FieldRulePresetCatalog,
): number[][] => {
  const parent = rows.map((_, index) => index);
  const root = (index: number): number => {
    let at = index;
    while (parent[at] !== at) {
      parent[at] = parent[parent[at]];
      at = parent[at];
    }
    return at;
  };
  const owner = new Map<string, number>();
  rows.forEach((row, index) => {
    for (const entry of planRecordKeys(keys, row.data, collection, catalog).entries) {
      const seen = owner.get(entry.keyId);
      if (seen === undefined) {
        owner.set(entry.keyId, index);
        continue;
      }
      const [low, high] = [root(seen), root(index)].sort((a, b) => a - b);
      parent[high] = low;
    }
  });
  const lanes = new Map<number, number[]>();
  rows.forEach((_, index) => {
    const lane = root(index);
    lanes.set(lane, [...(lanes.get(lane) ?? []), index]);
  });
  return [...lanes.values()];
};

/** Roda cada raia em ordem, até `concurrency` raias ao mesmo tempo. O resultado segue a ordem de `items`. */
export const runInLanes = async <T, R>(
  items: readonly T[],
  lanes: readonly number[][],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const drain = async (): Promise<void> => {
    while (next < lanes.length) {
      const lane = lanes[next];
      next += 1;
      for (const index of lane) results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, lanes.length) }, drain));
  return results;
};

export interface RecordImportAuditFact {
  tenantId: string;
  importId: string;
  collection: string;
  screenTitle: string;
  fileName: string;
  totalRows: number;
  totals: RecordImportTotals;
  status: Exclude<RecordImportStatus, 'running'>;
  actor: { userId: string; name: string; photoURL: string };
}

/**
 * A linha ÚNICA de Auditoria da importação: quem, em que tela, de que arquivo, e o que resultou. Cada
 * registro gravado continua tendo a própria linha (`updatedVia: 'import'`) — esta é a que diz que eles
 * vieram juntos, e quantos ficaram de fora.
 *
 * É HIGH porque é uma alteração em massa: é o que quem audita procura primeiro. Não acende o selo, que é
 * de falha.
 */
export const recordImportAuditEntry = (fact: RecordImportAuditFact): CreateAuditLogInput => ({
  tenantId: fact.tenantId,
  title: fact.status === 'cancelled' ? '@core.records/import.audit.cancelled' : '@core.records/import.audit.finished',
  titleParams: { screen: fact.screenTitle, file: fact.fileName },
  userId: fact.actor.userId,
  userName: fact.actor.name,
  photoURL: fact.actor.photoURL,
  action: 'SYSTEM',
  severity: 'HIGH',
  type: 'AUDIT',
  entity: fact.collection,
  entityId: fact.importId,
  text: '@core.records/import.audit.detail',
  textParams: {
    file: fact.fileName,
    total: String(fact.totalRows),
    processed: String(fact.totals.created + fact.totals.updated + fact.totals.failed),
    created: String(fact.totals.created),
    updated: String(fact.totals.updated),
    failed: String(fact.totals.failed),
  },
});
