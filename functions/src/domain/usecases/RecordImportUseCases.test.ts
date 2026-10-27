import { describe, expect, it } from 'vitest';
import { makeRecordImportUseCases, RecordImportRefusal } from './RecordImportUseCases';
import type { RecordImportActor, RecordImportUpsert } from './RecordImportUseCases';
import type { CreateAuditLogInput } from './CreateAuditLogUseCase';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { SchemaScreen } from '../schema/pathResolver';
import type { RecordImportRow, RecordImportRowResult } from '../schema/recordImport';
import { RECORD_IMPORT_BATCH_SIZE, tallyImportResults } from '../schema/recordImport';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import { FakeMutationRepository } from '../repositories/fakeWorkflowMutationRepository';
import { FakeRecordImportJobs } from '../repositories/fakeRecordImportJobs';
import { runWorkflowUpsert } from '../../infrastructure/workflow/mutation/runWorkflowMutation';

/**
 * A importação de ponta a ponta sobre o `runWorkflowUpsert` DE VERDADE — só o banco é falso. É o que
 * prova que a importação não tem regra própria: tudo o que ela recusa, recusa porque o caminho de
 * gravação de sempre recusa.
 */
const contribuintes: SchemaScreen = {
  id: 'contribuintes',
  titleSingular: 'Contribuinte',
  titlePlural: 'Contribuintes',
  titleFieldKey: 'nome',
  fields: [
    { key: 'documento', label: 'Documento', type: 'text', required: true, order: 0, origin: 'design' },
    { key: 'nome', label: 'Nome', type: 'text', required: true, order: 1, origin: 'design' },
    { key: 'email', label: 'E-mail', type: 'text', required: false, order: 2, origin: 'design' },
  ],
  keys: [
    { name: 'documento', kind: 'primary', fields: ['documento'] },
    { name: 'email', kind: 'unique', fields: ['email'], normalize: { caseInsensitive: true } },
  ],
};

const anotacoes: SchemaScreen = {
  id: 'anotacoes',
  titleSingular: 'Anotação',
  titleFieldKey: 'texto',
  fields: [{ key: 'texto', label: 'Texto', type: 'text', required: true, order: 0, origin: 'design' }],
};

const TENANT = 't1';
const ana: RecordImportActor = { userId: 'u-ana', name: 'Ana', photoURL: '', permissions: ['*'] };

const setup = () => {
  const repo = new FakeMutationRepository();
  const jobs = new FakeRecordImportJobs();
  const audit: CreateAuditLogInput[] = [];
  const screenProvider = fakeScreenProvider([contribuintes, anotacoes], [{ collection: 'situacoes', label: 'Situação' }]);
  const upsertFor = async (tenantId: string, actor: RecordImportActor): Promise<RecordImportUpsert> => {
    const context = {
      event: { id: '', tenantId, name: 'record.import', payload: {}, timestamp: new Date() },
      outputs: {},
      variables: {},
      services: { logger: { info: () => undefined, warn: () => undefined, error: () => undefined }, now: () => new Date() },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      execution: { id: 'x', workflowDefinitionId: '', tenantId },
      actor: { ...actor, via: 'import' as const },
      reader: { uid: actor.userId, permissions: actor.permissions },
    } as WorkflowContext;
    return async (spec, dryRun) => {
      const outcome = await runWorkflowUpsert(spec, context, { mutationRepository: repo, screenProvider }, {
        matchPrimaryKey: true,
        requireCollectionPermission: true,
        enforceRequired: true,
        dryRun,
      });
      return outcome.ok ? { ok: true, value: { id: outcome.value.id, created: outcome.value.created } } : outcome;
    };
  };
  const useCases = makeRecordImportUseCases({
    jobs,
    screenProvider,
    audit: { execute: async (input) => { audit.push(input); } },
    upsertFor,
  });
  return { repo, jobs, audit, useCases };
};

/** Mil linhas; uma em cada dez sem nome (obrigatório). As linhas do arquivo começam na 2 (a 1 é o cabeçalho). */
const thousandRows = (nameOf: (index: number) => string = (index) => `Contribuinte ${index}`): RecordImportRow[] =>
  Array.from({ length: 1000 }, (_, index) => ({
    line: index + 2,
    data: { documento: String(100000 + index), nome: index % 10 === 0 ? '' : nameOf(index) },
  }));

const inBatches = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / RECORD_IMPORT_BATCH_SIZE) }, (_, index) =>
    items.slice(index * RECORD_IMPORT_BATCH_SIZE, (index + 1) * RECORD_IMPORT_BATCH_SIZE));

const runImport = async (
  useCases: ReturnType<typeof setup>['useCases'],
  rows: RecordImportRow[],
  table = 'contribuintes',
): Promise<{ importId: string; results: RecordImportRowResult[] }> => {
  const { importId } = await useCases.start({ tenantId: TENANT, table, fileName: 'cadastro.csv', totalRows: rows.length, actor: ana });
  const results: RecordImportRowResult[] = [];
  for (const batch of inBatches(rows)) {
    results.push(...(await useCases.rows({ tenantId: TENANT, table, importId, dryRun: false, rows: batch, actor: ana })).results);
  }
  return { importId, results };
};

const simulate = async (useCases: ReturnType<typeof setup>['useCases'], rows: RecordImportRow[]) => {
  const results: RecordImportRowResult[] = [];
  for (const batch of inBatches(rows)) {
    results.push(...(await useCases.rows({ tenantId: TENANT, table: 'contribuintes', dryRun: true, rows: batch, actor: ana })).results);
  }
  return results;
};

const refusal = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RecordImportRefusal) return error.message;
    throw error;
  }
  throw new Error('esperava recusa');
};

describe('importação em massa — mil linhas pelo caminho validado', () => {
  it('a simulação lista cada linha recusada pelo número dela, e não grava nada', async () => {
    const { repo, jobs, audit, useCases } = setup();
    const results = await simulate(useCases, thousandRows());

    expect(tallyImportResults(results)).toEqual({ created: 900, updated: 0, failed: 100 });
    const failed = results.filter((result) => result.status === 'failed');
    expect(failed[0]).toMatchObject({ line: 2, error: '@core.automation/mutation.upsert.required', errorParams: { field: 'Nome' } });
    expect(failed.map((result) => result.line)).toEqual(Array.from({ length: 100 }, (_, index) => index * 10 + 2));
    expect(repo.store.size).toBe(0);
    expect(repo.keys.size).toBe(0);
    expect(jobs.jobs.size).toBe(0);
    expect(audit).toHaveLength(0);
  });

  it('a execução grava as válidas, carimba a origem e fecha com UMA linha de Auditoria', async () => {
    const { repo, jobs, audit, useCases } = setup();
    const { importId, results } = await runImport(useCases, thousandRows());

    expect(tallyImportResults(results)).toEqual({ created: 900, updated: 0, failed: 100 });
    expect(repo.store.size).toBe(900);
    expect([...repo.store.values()][0]).toMatchObject({ createdBy: 'u-ana', createdVia: 'import', updatedVia: 'import' });
    expect(jobs.jobs.get(importId)?.totals).toEqual({ created: 900, updated: 0, failed: 100 });

    const { totals } = await useCases.finish({ tenantId: TENANT, importId, cancelled: false, actor: ana });
    expect(totals).toEqual({ created: 900, updated: 0, failed: 100 });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      title: '@core.records/import.audit.finished',
      titleParams: { screen: 'Contribuintes', file: 'cadastro.csv' },
      severity: 'HIGH',
      entity: 'contribuintes',
      entityId: importId,
      userId: 'u-ana',
      textParams: { total: '1000', processed: '1000', created: '900', updated: '0', failed: '100' },
    });
  });

  it('reprocessar o MESMO arquivo é idempotente: altera pela chave primary e não cria nenhum', async () => {
    const { repo, useCases } = setup();
    await runImport(useCases, thousandRows());
    const second = await runImport(useCases, thousandRows((index) => `Contribuinte ${index} (revisto)`));

    expect(tallyImportResults(second.results)).toEqual({ created: 0, updated: 900, failed: 100 });
    expect(repo.store.size).toBe(900);
    expect(repo.createCalls).toHaveLength(900);
    expect([...repo.store.values()].every((record) => String(record.nome).endsWith('(revisto)'))).toBe(true);
  });

  it('a simulação depois da primeira carga diz que as linhas ALTERARIAM', async () => {
    const { useCases } = setup();
    await runImport(useCases, thousandRows());
    expect(tallyImportResults(await simulate(useCases, thousandRows()))).toEqual({ created: 0, updated: 900, failed: 100 });
  });
});

describe('importação — linhas que disputam a mesma chave no mesmo lote', () => {
  it('a mesma chave primary duas vezes: a de cima cria, a de baixo altera — nunca duplica', async () => {
    const { repo, useCases } = setup();
    const { results } = await runImport(useCases, [
      { line: 2, data: { documento: '1', nome: 'Primeira' } },
      { line: 3, data: { documento: '2', nome: 'Outra' } },
      { line: 4, data: { documento: '1', nome: 'Segunda' } },
    ]);
    expect(results.map((result) => result.status)).toEqual(['created', 'created', 'updated']);
    expect(repo.store.size).toBe(2);
    expect([...repo.store.values()].find((record) => record.documento === '1')).toMatchObject({ nome: 'Segunda' });
  });

  it('a mesma chave unique em duas linhas: quem perde é sempre a de baixo', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { useCases } = setup();
      const { results } = await runImport(useCases, [
        { line: 2, data: { documento: '1', nome: 'A', email: 'x@y.com' } },
        { line: 3, data: { documento: '2', nome: 'B', email: 'X@Y.COM' } },
      ]);
      expect(results[0].status).toBe('created');
      expect(results[1]).toMatchObject({ status: 'failed', error: '@core.automation/mutation.upsert.key-conflict' });
    }
  });
});

describe('importação — o que é recusado antes de qualquer linha', () => {
  it('tela de quem não pode criar NEM alterar', async () => {
    const { useCases } = setup();
    const reader = { ...ana, permissions: ['contribuintes.read'] };
    expect(await refusal(useCases.start({ tenantId: TENANT, table: 'contribuintes', fileName: 'a.csv', totalRows: 1, actor: reader })))
      .toBe('@core.access/permission.denied');
  });

  it('lista de opções não é tela, e tabela desconhecida não existe', async () => {
    const { useCases } = setup();
    expect(await refusal(useCases.start({ tenantId: TENANT, table: 'situacoes', fileName: 'a.csv', totalRows: 1, actor: ana })))
      .toBe('@core.records/import.error.not-a-screen');
    expect(await refusal(useCases.start({ tenantId: TENANT, table: 'inexistente', fileName: 'a.csv', totalRows: 1, actor: ana })))
      .toBe('@core.automation/mutation.table.unknown');
  });

  it('total fora do teto, lote grande demais, linha repetida no lote', async () => {
    const { useCases } = setup();
    expect(await refusal(useCases.start({ tenantId: TENANT, table: 'contribuintes', fileName: 'a.csv', totalRows: 50_001, actor: ana })))
      .toBe('@core.records/import.error.too-many-rows');
    const big = Array.from({ length: RECORD_IMPORT_BATCH_SIZE + 1 }, (_, index) => ({ line: index + 2, data: { nome: 'x' } }));
    expect(await refusal(useCases.rows({ tenantId: TENANT, table: 'contribuintes', dryRun: true, rows: big, actor: ana })))
      .toBe('@core.records/import.error.batch-too-large');
    const repeated = [{ line: 2, data: {} }, { line: 2, data: {} }];
    expect(await refusal(useCases.rows({ tenantId: TENANT, table: 'contribuintes', dryRun: true, rows: repeated, actor: ana })))
      .toBe('@core.records/import.error.batch-malformed');
  });

  it('mais linhas do que o total declarado no início', async () => {
    const { useCases } = setup();
    const { importId } = await useCases.start({ tenantId: TENANT, table: 'contribuintes', fileName: 'a.csv', totalRows: 1, actor: ana });
    const rows = [{ line: 2, data: { documento: '1', nome: 'A' } }, { line: 3, data: { documento: '2', nome: 'B' } }];
    expect(await refusal(useCases.rows({ tenantId: TENANT, table: 'contribuintes', importId, dryRun: false, rows, actor: ana })))
      .toBe('@core.records/import.error.too-many-rows');
  });

  it('o job de outra pessoa responde como o que não existe — e a tabela é a do job, não a do pedido', async () => {
    const { repo, useCases } = setup();
    const { importId } = await useCases.start({ tenantId: TENANT, table: 'contribuintes', fileName: 'a.csv', totalRows: 5, actor: ana });
    const bia = { ...ana, userId: 'u-bia' };
    const row = [{ line: 2, data: { documento: '1', nome: 'A' } }];
    expect(await refusal(useCases.rows({ tenantId: TENANT, table: 'contribuintes', importId, dryRun: false, rows: row, actor: bia })))
      .toBe('@core.records/import.error.not-found');

    await useCases.rows({ tenantId: TENANT, table: 'anotacoes', importId, dryRun: false, rows: row, actor: ana });
    expect(repo.createCalls[0].collection).toBe('contribuintes');
  });

  it('fechar duas vezes grava UMA linha de Auditoria, e o job fechado não recebe mais lotes', async () => {
    const { audit, useCases } = setup();
    const { importId } = await runImport(useCases, [{ line: 2, data: { documento: '1', nome: 'A' } }]);
    await useCases.finish({ tenantId: TENANT, importId, cancelled: true, actor: ana });
    expect(await refusal(useCases.finish({ tenantId: TENANT, importId, cancelled: false, actor: ana })))
      .toBe('@core.records/import.error.closed');
    expect(await refusal(useCases.rows({ tenantId: TENANT, table: 'contribuintes', importId, dryRun: false, rows: [{ line: 3, data: {} }], actor: ana })))
      .toBe('@core.records/import.error.closed');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ title: '@core.records/import.audit.cancelled', textParams: { total: '1', processed: '1' } });
  });
});

describe('importação — a permissão é cobrada linha a linha', () => {
  it('quem só cria vê recusada a linha que alteraria, e a que cria passa', async () => {
    const { useCases } = setup();
    await runImport(useCases, [{ line: 2, data: { documento: '1', nome: 'A' } }]);
    const creator = { ...ana, permissions: ['contribuintes.create'] };
    const { importId } = await useCases.start({ tenantId: TENANT, table: 'contribuintes', fileName: 'b.csv', totalRows: 2, actor: creator });
    const { results } = await useCases.rows({
      tenantId: TENANT,
      table: 'contribuintes',
      importId,
      dryRun: false,
      rows: [{ line: 2, data: { documento: '1', nome: 'A2' } }, { line: 3, data: { documento: '2', nome: 'B' } }],
      actor: creator,
    });
    expect(results[0]).toMatchObject({ status: 'failed', error: '@core.access/permission.denied', errorParams: { permission: 'contribuintes.update' } });
    expect(results[1]).toMatchObject({ status: 'created' });
  });

  it('a falha de infraestrutura numa linha não derruba o lote', async () => {
    const { repo, useCases } = setup();
    const original = repo.create.bind(repo);
    repo.create = async (...args: Parameters<typeof repo.create>) => {
      if (args[2].documento === '2') throw new Error('unavailable');
      return original(...args);
    };
    const { results } = await runImport(useCases, [
      { line: 2, data: { documento: '1', nome: 'A' } },
      { line: 3, data: { documento: '2', nome: 'B' } },
      { line: 4, data: { documento: '3', nome: 'C' } },
    ]);
    expect(results.map((result) => result.status)).toEqual(['created', 'failed', 'created']);
    expect(results[1].error).toBe('@core.records/import.error.row-failed');
  });
});
