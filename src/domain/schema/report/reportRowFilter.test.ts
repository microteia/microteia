import { describe, it, expect } from 'vitest';
import { filterReportRows, reportRowScope } from './reportRowFilter';
import { REPORT_SPEC_VERSION } from './reportSpec';
import type { ReportSpec } from './reportSpec';

/**
 * As linhas chegam ao filtro como chegam ao agregador: já varridas, hidratadas e materializadas — e
 * é por isso que `cliente` é o registro inteiro no lugar do id, e que uma delas simplesmente NÃO TEM
 * a chave `situacao`. Um campo nunca preenchido não existe no documento do Firestore, e é esse o
 * caso que derrubava a avaliação.
 */
const rows: Record<string, unknown>[] = [
  { id: '1', situacao: 'pago', valor: 100, pago: 100, cliente: { id: 'c1', cidade: 'Recife' } },
  { id: '2', situacao: 'aberto', valor: 200, pago: 50, cliente: { id: 'c2', cidade: 'Olinda' } },
  { id: '3', situacao: 'aberto', valor: 300, pago: 300, cliente: { id: 'c1' } },
  { id: '4', valor: 400, pago: 0 },
];

const specWith = (includeWhen?: string): ReportSpec => ({
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'lancamentos',
    ...(includeWhen === undefined ? {} : { includeWhen }),
    dimensions: [{ key: 'situacao', path: 'situacao' }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
});

const keptIds = (includeWhen: string, input: Record<string, unknown>[] = rows): string[] => {
  const outcome = filterReportRows({ spec: specWith(includeWhen), rows: input });
  if (!outcome.ok) throw new Error(`esperava ok, veio recusa: ${outcome.error}`);
  return outcome.rows.map((row) => row.id as string);
};

describe('filterReportRows', () => {
  it('sem expressão, devolve as linhas como estavam — a MESMA lista, sem cópia', () => {
    const outcome = filterReportRows({ spec: specWith(), rows });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rows).toBe(rows);
  });

  it('expressão em branco é ausência de filtro, não filtro que nada atende', () => {
    expect(keptIds('   ')).toEqual(['1', '2', '3', '4']);
  });

  it('mantém a linha que responde verdadeiro', () => {
    expect(keptIds('situacao == "aberto"')).toEqual(['2', '3']);
  });

  it('compara DOIS campos entre si — a pergunta que um filtro fixo não escreve', () => {
    // É a razão de ser desta capacidade: nenhum predicado de `where` compara caminho com caminho.
    expect(keptIds('pago < valor')).toEqual(['2', '4']);
  });

  it('atravessa a referência pelo nome do apontado', () => {
    expect(keptIds('cliente.cidade == "Recife"')).toEqual(['1']);
  });

  /*
   * O caso que decidiu o desenho do escopo.
   *
   * O `expr-eval` ESTOURA ao ler um nome que não está no escopo, e um campo nunca preenchido não
   * existe no documento. Sem o escopo montado a partir dos caminhos da expressão, a linha 4 (sem
   * `situacao`) e a linha 3 (com cliente sem `cidade`) derrubariam a avaliação — e o relatório
   * inteiro seria recusado por um dado que simplesmente não foi digitado.
   */
  it('campo ausente no documento vale NULO, e não estouro', () => {
    expect(keptIds('isEmpty(situacao)')).toEqual(['4']);
    expect(keptIds('isEmpty(cliente.cidade)')).toEqual(['3', '4']);
  });

  it('o registro apontado continua inteiro quando a expressão também cita um campo dele', () => {
    // Espalhar o apontado e sobrepor o que a expressão cita: sem o espalhamento, `cliente.id`
    // desapareceria do escopo montado para `cliente.cidade`.
    expect(keptIds('cliente.id == "c1" and isEmpty(cliente.cidade)')).toEqual(['3']);
  });

  it('`value` vale o CAMPO de mesmo nome, porque a linha não tem valor próprio', () => {
    // O escopo do avaliador sobrescreve `value` sempre. Sem devolvê-lo ao campo, uma coleção com um
    // campo `value` veria toda comparação sobre ele responder sobre nulo — e o total sairia errado.
    const own = [{ id: '1', value: 10 }, { id: '2', value: 40 }];
    expect(keptIds('value > 20', own)).toEqual(['2']);
  });

  it('`hasPermission` responde pelo conjunto de quem executa, com `<entity>` na coleção-fonte', () => {
    const permitted = filterReportRows({
      spec: specWith('hasPermission("<entity>.read")'),
      rows,
      entity: 'lancamentos',
      permissions: ['lancamentos.read'],
    });
    expect(permitted.ok && permitted.rows).toHaveLength(4);

    const refused = filterReportRows({
      spec: specWith('hasPermission("<entity>.read")'),
      rows,
      entity: 'lancamentos',
      permissions: [],
    });
    expect(refused.ok && refused.rows).toHaveLength(0);
  });

  it('`today()` responde o instante do relatório, um só para todas as linhas', () => {
    const dated = [
      { id: '1', vencimento: '2026-05-01' },
      { id: '2', vencimento: '2026-05-30' },
    ];
    const outcome = filterReportRows({
      spec: specWith('vencimento < today()'),
      rows: dated,
      now: new Date('2026-05-10T12:00:00.000Z'),
    });

    expect(outcome.ok && outcome.rows.map((row) => row.id)).toEqual(['1']);
  });

  /*
   * A recusa, e por que ela não pode ser "descarte a linha".
   *
   * Este é o único lugar do relatório em que engolir a falha produz um total MENOR, com o mesmo
   * rótulo e sem uma palavra na tela — e um total menor é o defeito que o leitor não tem como notar.
   * `dataset` é a verdade do número: o que ele não consegue responder é recusa nomeada.
   */
  it('expressão que estoura RECUSA o relatório, em vez de descartar a linha calada', () => {
    // `getVar` lê o contexto de automação, que não existe num registro — ela está fora do catálogo
    // puro de propósito, e é aprovada pelo editor porque o catálogo do Workflow a tem.
    const outcome = filterReportRows({ spec: specWith('getVar("x") == 1'), rows });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe('@core.reports/filter.failed');
    expect(outcome.errorParams?.detail).toBeTruthy();
  });
});

describe('reportRowScope', () => {
  it('só existe o que a expressão cita — o escopo não é o registro inteiro', () => {
    expect(reportRowScope(rows[0], ['situacao'])).toEqual({ situacao: 'pago' });
  });

  it('o caminho ausente entra como nulo, em qualquer profundidade', () => {
    expect(reportRowScope(rows[3], ['situacao', 'cliente.cidade']))
      .toEqual({ situacao: null, cliente: { cidade: null } });
  });

  it('a data continua uma data — o escopo não a serializa', () => {
    const at = new Date('2026-05-05T00:00:00.000Z');
    expect(reportRowScope({ vencimento: at }, ['vencimento'])).toEqual({ vencimento: at });
  });
});
