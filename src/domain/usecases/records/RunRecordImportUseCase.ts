import type { IRecordImportRepository } from '../../repositories/IRecordImportRepository';
import { RECORD_IMPORT_BATCH_SIZE, tallyImportResults } from '../../schema/recordImport';
import type {
  RecordImportLookup,
  RecordImportParent,
  RecordImportRow,
  RecordImportRowResult,
  RecordImportTotals,
} from '../../schema/recordImport';

export interface RunRecordImportInput {
  tenantId: string;
  table: string;
  fileName: string;
  rows: RecordImportRow[];
  /** Linhas que o navegador já recusou (célula que não converte). Entram no total declarado e no relatório. */
  rejected: RecordImportRowResult[];
  /** A importação feita na aba de um registro: o servidor grava o vínculo em cada linha. */
  parent?: RecordImportParent;
  /** As colunas de referência que trazem a chave do alvo, e não o id. */
  lookups?: RecordImportLookup[];
  dryRun: boolean;
  onProgress: (done: number, total: number) => void;
  /** Consultado entre os lotes: o lote em curso termina, o seguinte não sai. */
  isCancelled: () => boolean;
}

export interface RunRecordImportOutcome {
  /** Todas as linhas — as do servidor e as recusadas no navegador —, na ordem do arquivo. */
  results: RecordImportRowResult[];
  totals: RecordImportTotals;
  cancelled: boolean;
}

export type RunRecordImportUseCase = {
  execute: (input: RunRecordImportInput) => Promise<RunRecordImportOutcome>;
};

const inBatches = <T>(items: readonly T[]): T[][] => {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += RECORD_IMPORT_BATCH_SIZE) {
    batches.push(items.slice(start, start + RECORD_IMPORT_BATCH_SIZE));
  }
  return batches;
};

/**
 * A simulação e a execução são o MESMO laço: a diferença é só se o servidor grava. A execução abre um job
 * antes e o fecha depois — e o fecha também quando para no meio (cancelada ou por falha), porque as
 * linhas já gravadas aconteceram e a linha de Auditoria precisa dizê-lo. A falha original é a que sobe.
 */
export const makeRunRecordImportUseCase = (repo: IRecordImportRepository): RunRecordImportUseCase => ({
  execute: async (input) => {
    const total = input.rows.length + input.rejected.length;
    const results: RecordImportRowResult[] = [...input.rejected];
    let done = input.rejected.length;
    let cancelled = false;
    input.onProgress(done, total);

    // Sem linha para o servidor não há o que importar — nem job, nem linha de Auditoria.
    const importId = input.dryRun || input.rows.length === 0
      ? undefined
      : await repo.start(input.tenantId, input.table, input.fileName, input.rows.length, input.parent);
    try {
      for (const rows of inBatches(input.rows)) {
        if (input.isCancelled()) {
          cancelled = true;
          break;
        }
        results.push(...await repo.sendRows(input.tenantId, {
          table: input.table,
          importId,
          dryRun: input.dryRun,
          rows,
          ...(input.parent ? { parent: input.parent } : {}),
          ...(input.lookups && input.lookups.length > 0 ? { lookups: input.lookups } : {}),
        }));
        done += rows.length;
        input.onProgress(done, total);
      }
    } catch (error) {
      if (importId) await repo.finish(input.tenantId, importId, true).catch(() => undefined);
      throw error;
    }
    if (importId) await repo.finish(input.tenantId, importId, cancelled);

    results.sort((left, right) => left.line - right.line);
    return { results, totals: tallyImportResults(results), cancelled };
  },
});
