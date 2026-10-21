import { describe, expect, it } from 'vitest';
import { WorkflowDocumentRecordReader } from './WorkflowDocumentRecordReader';
import type { IWorkflowQueryRepository, WorkflowQueryRow } from '../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaScreen } from '../../domain/schema/pathResolver';
import type { DocumentTemplateDataset } from '../../domain/schema/document/documentTemplate';
import { fakeScreenProvider } from '../../domain/repositories/fakeScreenProvider';

const movementsScreen: SchemaScreen = {
  id: 'movimentos',
  titleSingular: 'Movimento',
  titleFieldKey: 'descricao',
  fields: [
    { key: 'processo', label: 'Processo', type: 'reference', refEntity: 'processos', required: false, order: 0, origin: 'plugin' },
    { key: 'descricao', label: 'Descrição', type: 'text', required: false, order: 1, origin: 'plugin' },
    { key: 'date', label: 'Data', type: 'date', required: false, order: 2, origin: 'plugin' },
    { key: 'time', label: 'Hora', type: 'time', required: false, order: 3, origin: 'plugin' },
  ],
};

const casesScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'numero',
  fields: [{ key: 'numero', label: 'Número', type: 'text', required: false, order: 0, origin: 'plugin' }],
};

const row = (id: string, data: Record<string, unknown>): WorkflowQueryRow => ({ id, data: { processo: 'p1', ...data } });

const reader = (rows: WorkflowQueryRow[]) => {
  const queryRepository: IWorkflowQueryRepository = { queryByEquality: async () => rows };
  const fetcher: IWorkflowRecordFetcher = {
    fetchByIds: async (_tenantId, _collection, ids) => new Map(ids.map((id) => [id, null])),
  };
  return new WorkflowDocumentRecordReader(fetcher, fakeScreenProvider([movementsScreen, casesScreen]), queryRepository);
};

const idsOf = async (rows: WorkflowQueryRow[], dataset: Partial<DocumentTemplateDataset>): Promise<string[]> => {
  const outcome = await reader(rows).children(
    't1',
    { name: 'movimentacoes', from: 'movimentos', via: 'processo', ...dataset },
    'p1',
    [],
    'America/Sao_Paulo',
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.value.map((record) => String(record.id));
};

/** O relatório de andamento: dois dias, horas fora de ordem, na ordem em que o banco devolveria. */
const movements = [
  row('m1', { date: '2026-10-20', time: '10:57' }),
  row('m2', { date: '2026-10-20', time: '11:07' }),
  row('m3', { date: '2026-10-19', time: '16:11' }),
  row('m4', { date: '2026-10-19', time: '16:13' }),
  row('m5', { date: '2026-10-19', time: '16:14' }),
  row('m6', { date: '2026-10-19', time: '16:12' }),
];

describe('WorkflowDocumentRecordReader.children — ordem do dataset', () => {
  it('ordena por data e hora quando o orderBy é uma lista', async () => {
    const ids = await idsOf(movements, {
      orderBy: [{ path: 'date', dir: 'desc' }, { path: 'time', dir: 'desc' }],
    });
    expect(ids).toEqual(['m2', 'm1', 'm5', 'm4', 'm6', 'm3']);
  });

  it('com limit, entram os mais recentes do último dia — não os que o banco devolveu primeiro', async () => {
    const ids = await idsOf(movements, {
      orderBy: [{ path: 'date', dir: 'desc' }, { path: 'time', dir: 'desc' }],
      limit: 4,
    });
    expect(ids).toEqual(['m2', 'm1', 'm5', 'm4']);
  });

  it('a forma em texto continua valendo, com o sentido de direction', async () => {
    const rows = [row('a', { date: '2026-10-01' }), row('b', { date: '2026-10-03' }), row('c', { date: '2026-10-02' })];
    expect(await idsOf(rows, { orderBy: 'date', direction: 'desc' })).toEqual(['b', 'c', 'a']);
    expect(await idsOf(rows, { orderBy: 'date' })).toEqual(['a', 'c', 'b']);
  });

  it('vazio vai por último nos dois sentidos, e o empate cai no createdAt e depois no id', async () => {
    const rows = [
      row('z', { date: '' }),
      row('y', { date: '2026-10-01', createdAt: new Date('2026-10-01T09:00:00Z') }),
      row('x', { date: '2026-10-01', createdAt: new Date('2026-10-01T10:00:00Z') }),
      row('w', { date: '2026-10-01', createdAt: new Date('2026-10-01T10:00:00Z') }),
      row('v', { date: '2026-10-02' }),
    ];
    expect(await idsOf(rows, { orderBy: [{ path: 'date', dir: 'desc' }] })).toEqual(['v', 'w', 'x', 'y', 'z']);
    expect(await idsOf(rows, { orderBy: [{ path: 'date', dir: 'asc' }] })).toEqual(['y', 'w', 'x', 'v', 'z']);
  });

  it('aceita createdAt como chave, como o latest', async () => {
    const rows = [
      row('a', { createdAt: new Date('2026-10-01T09:00:00Z') }),
      row('b', { createdAt: new Date('2026-10-03T09:00:00Z') }),
    ];
    expect(await idsOf(rows, { orderBy: [{ path: 'createdAt', dir: 'desc' }] })).toEqual(['b', 'a']);
  });

  it('sem orderBy, devolve na ordem do banco', async () => {
    expect(await idsOf(movements, {})).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  });
});
