import { describe, expect, it } from 'vitest';
import { makeRunRecordImportUseCase } from './RunRecordImportUseCase';
import type { IRecordImportRepository } from '../../repositories/IRecordImportRepository';
import type { RecordImportRow } from '../../schema/recordImport';
import { RECORD_IMPORT_BATCH_SIZE } from '../../schema/recordImport';

const rowsOf = (count: number): RecordImportRow[] =>
  Array.from({ length: count }, (_, index) => ({ line: index + 2, data: { nome: `R${index}` } }));

const fakeRepo = (options: { failOnBatch?: number } = {}) => {
  const calls: string[] = [];
  let batch = 0;
  const repo: IRecordImportRepository = {
    start: async (_tenant, _table, _file, totalRows) => {
      calls.push(`start:${totalRows}`);
      return 'imp-1';
    },
    sendRows: async (_tenant, { importId, dryRun, rows }) => {
      batch += 1;
      calls.push(`rows:${importId ?? '-'}:${dryRun}:${rows.length}`);
      if (batch === options.failOnBatch) throw new Error('@core.records/import.error.closed');
      return rows.map((row) => ({ line: row.line, status: 'created' as const }));
    },
    finish: async (_tenant, importId, cancelled) => {
      calls.push(`finish:${importId}:${cancelled}`);
      return { created: 0, updated: 0, failed: 0 };
    },
  };
  return { repo, calls };
};

const base = { tenantId: 't1', table: 'contribuintes', fileName: 'a.csv', onProgress: () => undefined, isCancelled: () => false };

describe('RunRecordImportUseCase', () => {
  it('a simulação manda os lotes sem abrir nem fechar job', async () => {
    const { repo, calls } = fakeRepo();
    const outcome = await makeRunRecordImportUseCase(repo).execute({ ...base, rows: rowsOf(250), rejected: [], dryRun: true });
    expect(calls).toEqual([
      `rows:-:true:${RECORD_IMPORT_BATCH_SIZE}`,
      `rows:-:true:${RECORD_IMPORT_BATCH_SIZE}`,
      'rows:-:true:50',
    ]);
    expect(outcome.totals).toEqual({ created: 250, updated: 0, failed: 0 });
  });

  it('a execução abre o job com as linhas que vão ao servidor, e o fecha; o relatório junta as recusadas no navegador, na ordem do arquivo', async () => {
    const { repo, calls } = fakeRepo();
    const progress: number[] = [];
    const outcome = await makeRunRecordImportUseCase(repo).execute({
      ...base,
      rows: rowsOf(3),
      rejected: [{ line: 3, status: 'failed', error: '@core.records/import.cell.not-a-number' }],
      dryRun: false,
      onProgress: (done) => progress.push(done),
    });
    expect(calls).toEqual(['start:3', 'rows:imp-1:false:3', 'finish:imp-1:false']);
    expect(outcome.results.map((result) => result.line)).toEqual([2, 3, 3, 4]);
    expect(outcome.totals).toEqual({ created: 3, updated: 0, failed: 1 });
    expect(progress).toEqual([1, 4]);
  });

  it('cancelar entre lotes fecha o job como cancelado', async () => {
    const { repo, calls } = fakeRepo();
    let sent = 0;
    const outcome = await makeRunRecordImportUseCase(repo).execute({
      ...base,
      rows: rowsOf(RECORD_IMPORT_BATCH_SIZE * 3),
      rejected: [],
      dryRun: false,
      onProgress: (done) => { sent = done; },
      isCancelled: () => sent >= RECORD_IMPORT_BATCH_SIZE,
    });
    expect(outcome.cancelled).toBe(true);
    expect(calls.at(-1)).toBe('finish:imp-1:true');
    expect(calls.filter((call) => call.startsWith('rows'))).toHaveLength(1);
  });

  it('a falha no meio fecha o job como cancelado e sobe a falha original', async () => {
    const { repo, calls } = fakeRepo({ failOnBatch: 2 });
    await expect(makeRunRecordImportUseCase(repo).execute({
      ...base,
      rows: rowsOf(RECORD_IMPORT_BATCH_SIZE * 2),
      rejected: [],
      dryRun: false,
    })).rejects.toThrow('@core.records/import.error.closed');
    expect(calls.at(-1)).toBe('finish:imp-1:true');
  });
});
