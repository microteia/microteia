import { describe, expect, it } from 'vitest';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryRow,
} from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';
import type { RecordReader } from '../../../domain/schema/memberVisibility';
import { runRecordQuery } from './runWorkflowQuery';
import { readerFetcher, scanVisibleRows } from './readerScope';

/**
 * A leitura do servidor ENTREGUE a uma pessoa numa coleção com `memberVisibility`. O Admin SDK passa
 * por cima do `firestore.rules`: o que estes testes provam é que o motor de consulta — o mesmo do
 * relatório, do agente e do documento — não entrega o que a regra esconderia.
 */

const respostas: SchemaScreen = {
  id: 'respostas',
  titleSingular: 'Resposta',
  titleFieldKey: 'texto',
  fields: [
    { key: 'texto', label: 'Texto', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'processo', label: 'Processo', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'emissor', label: 'Emissor', type: 'reference', refEntity: 'members', required: false, order: 2, origin: 'design' },
    { key: 'equipe', label: 'Equipe', type: 'reference', refEntity: 'members', multi: true, required: false, order: 3, origin: 'design' },
  ],
  memberVisibility: { userFields: ['emissor', 'equipe'] },
};

const tramites: SchemaScreen = {
  id: 'tramites',
  titleSingular: 'Trâmite',
  titleFieldKey: 'nota',
  fields: [
    { key: 'nota', label: 'Nota', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'respostaId', label: 'Resposta', type: 'reference', refEntity: 'respostas', refDenormKey: 'resposta', required: false, order: 1, origin: 'design' },
  ],
};

const RESPOSTAS: WorkflowQueryRow[] = [
  { id: 'r1', data: { texto: 'da ana', processo: 'p1', emissor: 'ana', equipe: [] } },
  { id: 'r2', data: { texto: 'da equipe', processo: 'p1', emissor: 'bia', equipe: ['ana'] } },
  { id: 'r3', data: { texto: 'da bia', processo: 'p1', emissor: 'bia', equipe: [] } },
  { id: 'r4', data: { texto: 'outro processo', processo: 'p2', emissor: 'caio', equipe: ['ana'] } },
];

const valueAt = (data: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], data);

/** O banco no que importa aqui: igualdade e `array-contains`, cada filtro do jeito que o Firestore o lê. */
class FakeQueryRepository implements IWorkflowQueryRepository {
  calls: WorkflowEqualityFilter[][] = [];
  constructor(private readonly rows: Record<string, WorkflowQueryRow[]>) {}
  async queryByEquality(_tenantId: string, collection: string, filters: WorkflowEqualityFilter[], limit: number) {
    this.calls.push(filters);
    return (this.rows[collection] ?? [])
      .filter((row) => filters.every((filter) => {
        const value = valueAt(row.data, filter.path);
        return filter.op === 'array-contains'
          ? Array.isArray(value) && value.includes(filter.value)
          : value === filter.value;
      }))
      .slice(0, limit);
  }
}

class FakeFetcher implements IWorkflowRecordFetcher {
  constructor(private readonly byCollection: Record<string, WorkflowQueryRow[]>) {}
  async fetchByIds(_tenantId: string, collection: string, ids: string[]) {
    const rows = this.byCollection[collection] ?? [];
    return new Map(ids.map((id) => [id, rows.find((row) => row.id === id)?.data ?? null]));
  }
}

const data = { respostas: RESPOSTAS, tramites: [{ id: 't1', data: { nota: 'encaminhado', respostaId: 'r3' } }] };
const deps = () => {
  const queryRepository = new FakeQueryRepository(data);
  return {
    queryRepository,
    deps: { queryRepository, fetcher: new FakeFetcher(data), screenProvider: fakeScreenProvider([respostas, tramites]) },
  };
};

const ana: RecordReader = { uid: 'ana', permissions: ['respostas.read', 'tramites.read'] };
const chefe: RecordReader = { uid: 'chefe', permissions: ['respostas.read', 'respostas.read-all'] };

const ids = async (reader: RecordReader | null, where: { path: string; value: string }[] = []) => {
  const outcome = await runRecordQuery(
    {
      table: 'respostas',
      where: where.map((one) => ({ path: one.path, op: 'eq' as const, value: { kind: 'Literal' as const, value: one.value } })),
      limit: 100,
      projections: [],
    },
    where.map((one) => one.value),
    { tenantId: 't1', reader },
    deps().deps,
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.value.results.map((record) => record.id).sort();
};

describe('a consulta entregue a uma pessoa', () => {
  it('traz só o que a nomeia — pelo campo simples ou pelo `multi`', async () => {
    expect(await ids(ana)).toEqual(['r1', 'r2', 'r4']);
  });

  it('os filtros de igualdade continuam valendo sobre o que veio do `array-contains`, que não os levou', async () => {
    expect(await ids(ana, [{ path: 'processo', value: 'p1' }])).toEqual(['r1', 'r2']);
  });

  it('quem supervisiona e a automação (sem leitor) leem a coleção inteira, como sempre', async () => {
    expect(await ids(chefe)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(await ids(null)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('a leitura por id também não entrega o registro que não a nomeia', async () => {
    expect(await ids(ana, [{ path: 'id', value: 'r3' }])).toEqual([]);
    expect(await ids(ana, [{ path: 'id', value: 'r1' }])).toEqual(['r1']);
  });

  it('o registro APONTADO que ela não vê chega como ausente — a projeção não o atravessa', async () => {
    const projected = async (reader: RecordReader | null) => {
      const outcome = await runRecordQuery(
        { table: 'tramites', where: [], limit: 10, projections: ['resposta.texto'] },
        [],
        { tenantId: 't1', reader },
        deps().deps,
      );
      if (!outcome.ok) throw new Error(outcome.error);
      return JSON.stringify(outcome.value.results);
    };
    expect(await projected(null)).toContain('da bia');
    expect(await projected(ana)).not.toContain('da bia');
  });

  it('pergunta ao banco só pelo que a nomeia — duas consultas por campo, e nenhuma pede índice composto', async () => {
    const { queryRepository, deps: queryDeps } = deps();
    await runRecordQuery(
      {
        table: 'respostas',
        where: [{ path: 'processo', op: 'eq', value: { kind: 'Literal', value: 'p1' } }],
        limit: 100,
        projections: [],
      },
      ['p1'],
      { tenantId: 't1', reader: ana },
      queryDeps,
    );
    expect(queryRepository.calls).toEqual([
      [{ path: 'processo', value: 'p1' }, { path: 'emissor', value: 'ana' }],
      [{ path: 'emissor', value: 'ana', op: 'array-contains' }],
      [{ path: 'processo', value: 'p1' }, { path: 'equipe', value: 'ana' }],
      [{ path: 'equipe', value: 'ana', op: 'array-contains' }],
    ]);
  });
});

describe('scanVisibleRows', () => {
  it('a união sem repetição, e `complete` só quando nenhuma consulta bateu no teto', async () => {
    const repository = new FakeQueryRepository({ respostas: RESPOSTAS });
    const spec = { userFields: ['emissor', 'equipe'] };
    const full = await scanVisibleRows(repository, 't1', 'respostas', [], spec, 'ana', 10);
    expect(full.rows.map((row) => row.id).sort()).toEqual(['r1', 'r2', 'r4']);
    expect(full.complete).toBe(true);

    const capped = await scanVisibleRows(repository, 't1', 'respostas', [], spec, 'ana', 1);
    expect(capped.rows).toHaveLength(1);
    expect(capped.complete).toBe(false);
  });
});

describe('readerFetcher', () => {
  it('sem leitor é o próprio fetcher — nada muda para a automação', () => {
    const fetcher = new FakeFetcher(data);
    expect(readerFetcher(fetcher, createSchemaContext([respostas]), null)).toBe(fetcher);
  });

  it('na coleção sem declaração, devolve o que leu', async () => {
    const fetched = await readerFetcher(new FakeFetcher(data), createSchemaContext([respostas, tramites]), ana)
      .fetchByIds('t1', 'tramites', ['t1']);
    expect(fetched.get('t1')).toEqual({ nota: 'encaminhado', respostaId: 'r3' });
  });
});
