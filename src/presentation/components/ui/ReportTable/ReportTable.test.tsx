// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { createSchemaContext } from '../../../../domain/schema/pathResolver';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { ReportTable } from './ReportTable.view';

// O rótulo e a tradução vêm de provedores que esta tabela não deveria precisar para desenhar: ela
// recebe o resultado agregado e nada mais. Os dublês existem para provar isso.
vi.mock('../../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
  useLocaleFormat: () => ({
    formatNumber: (value: number | null | undefined) => String(value ?? ''),
    formatMoney: (value: number | null | undefined) => String(value ?? ''),
    formatDate: () => '',
    formatDateTime: () => '',
    formatLongDate: () => '',
    compareText: () => 0,
    currency: 'BRL',
  }),
}));

vi.mock('../../../shared/report/useReportGroupLabels', () => ({
  useReportGroupLabels: () => (entry: { key: string } | undefined) => entry?.key ?? '',
}));

// O schema entra de verdade — é ele que sabe que `amigosIds` aponta para uma coleção e qual campo
// nomeia o registro apontado. Dublar o texto da célula esconderia justamente o que se quer provar.
vi.mock('../../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([
    {
      id: 'pessoas',
      titleSingular: 'Pessoa',
      titleFieldKey: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' },
        { key: 'cidade', label: 'Cidade', type: 'text', required: false, order: 1, origin: 'design' },
        {
          key: 'amigosIds',
          label: 'Amigos',
          type: 'reference',
          required: false,
          order: 2,
          origin: 'design',
          refEntity: 'pessoas',
          multi: true,
        },
      ],
    },
  ]),
}));

const draw = (spec: ReportSpec, result: ReportResult) =>
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <ReportTable spec={spec} result={result} />
    </ThemeProvider>,
  );

const envelope = {
  columns: [],
  scanned: 2,
  complete: true,
  completeGroups: true,
  generatedAt: '2026-09-04T12:00:00.000Z',
};

/**
 * A LISTA SIMPLES foi o defeito que chegou à tela: a tabela lia `rows` nas duas dobras, e numa lista
 * simples o agregador devolve `records`. O sintoma era "Nenhum dado" sobre uma coleção cheia — a
 * leitura mais errada possível, porque parece problema do dado.
 */
describe('ReportTable — lista simples', () => {
  const spec: ReportSpec = {
    v: 1,
    dataset: {
      table: 'pessoas',
      dimensions: [
        { key: 'nome', path: 'nome', label: 'Nome' },
        { key: 'cidade', path: 'cidade', label: 'Cidade' },
      ],
      measures: [{ key: 'quantidade', op: 'count', label: 'Quantidade' }],
    },
    shape: { kind: 'tabular', columns: ['nome', 'cidade'] },
  };

  const result: ReportResult = {
    ...envelope,
    shape: 'tabular',
    rows: [],
    records: [
      { id: '1', nome: 'Ana', cidade: 'Recife' },
      { id: '2', nome: 'Bruno', cidade: 'Olinda' },
    ],
    totals: { values: { quantidade: 2 }, count: 2 },
  };

  it('mostra os REGISTROS, não "nenhum dado"', () => {
    draw(spec, result);

    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Recife')).toBeDefined();
    expect(screen.getByText('Bruno')).toBeDefined();
    expect(screen.queryByText('table.empty')).toBeNull();
  });

  it('uma coluna por dimensão declarada', () => {
    draw(spec, result);

    expect(screen.getByText('Nome')).toBeDefined();
    expect(screen.getByText('Cidade')).toBeDefined();
  });

  it('lê o valor por CAMINHO, atravessando referência', () => {
    const comHop: ReportSpec = {
      ...spec,
      dataset: { ...spec.dataset, dimensions: [{ key: 'cidade', path: 'cliente.cidade', label: 'Cidade' }] },
      shape: { kind: 'tabular', columns: ['cidade'] },
    };

    draw(comHop, {
      ...result,
      records: [{ id: '1', cliente: { cidade: 'Caruaru' } }],
    });

    expect(screen.getByText('Caruaru')).toBeDefined();
  });

  /**
   * O defeito que chegou à tela: a coluna de uma referência de VÁRIOS mostrava
   * `[object Object],[object Object]`. A linha já vem hidratada — o registro apontado inteiro no
   * lugar do id —, e nomear um registro é ler o campo-título da tela dele.
   */
  it('a referência de VÁRIOS mostra os nomes dos apontados', () => {
    const comReferencia: ReportSpec = {
      ...spec,
      dataset: { ...spec.dataset, dimensions: [{ key: 'amigos', path: 'amigosIds', label: 'Amigos' }] },
      shape: { kind: 'tabular', columns: ['amigos'] },
    };

    draw(comReferencia, {
      ...result,
      records: [{ id: '1', amigosIds: [{ id: 'p1', nome: 'Ana' }, { id: 'p2', nome: 'Bruno' }] }],
    });

    expect(screen.getByText('Ana, Bruno')).toBeDefined();
    expect(screen.queryByText(/object Object/)).toBeNull();
  });

  it('o total vem numa LINHA, porque as colunas do corpo não são números', () => {
    draw(spec, result);

    expect(screen.getByText(/table\.total.*Quantidade: 2/)).toBeDefined();
  });

  it('sem registro nenhum, aí sim diz que não há dado', () => {
    draw(spec, { ...result, records: [], totals: null });

    expect(screen.getByText('table.empty')).toBeDefined();
  });
});

describe('ReportTable — dobra agrupada', () => {
  const spec: ReportSpec = {
    v: 1,
    dataset: {
      table: 'lancamentos',
      dimensions: [{ key: 'situacao', path: 'situacao', label: 'Situação' }],
      measures: [{ key: 'total', op: 'sum', path: 'valor', label: 'Total' }],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
  };

  const result: ReportResult = {
    ...envelope,
    shape: 'summary',
    rows: [
      { keys: [{ dimension: 'situacao', key: 'pago' }], values: { total: 300 }, count: 2, level: 0 },
      { keys: [{ dimension: 'situacao', key: 'aberto' }], values: { total: 50 }, count: 1, level: 0 },
    ],
    totals: { values: { total: 350 }, count: 3 },
  };

  it('mostra um grupo por linha, com o número ao lado', () => {
    draw(spec, result);

    expect(screen.getByText('pago')).toBeDefined();
    expect(screen.getByText('300')).toBeDefined();
    expect(screen.getByText('aberto')).toBeDefined();
  });

  it('o total do agrupado é alinhado À COLUNA da medida', () => {
    draw(spec, result);

    expect(screen.getByText('350')).toBeDefined();
    expect(screen.getByText('table.total')).toBeDefined();
  });
});

/**
 * A LISTA AGRUPADA: as colunas continuam sendo os campos, e o que muda é que as linhas passam a vir
 * reunidas sob o valor do campo que agrupa, com o total de cada grupo ao fechá-lo.
 *
 * Era o que o resumo NÃO fazia: ali cada campo virava um nível de recuo numa coluna só, e os
 * registros desapareciam — uma linha por coluna, que não é lista nenhuma.
 */
describe('ReportTable — lista agrupada', () => {
  const spec: ReportSpec = {
    v: 1,
    dataset: {
      table: 'pessoas',
      dimensions: [
        { key: 'nome', path: 'nome', label: 'Nome' },
        { key: 'cidade', path: 'cidade', label: 'Cidade' },
      ],
      measures: [{ key: 'quantidade', op: 'count', label: 'Quantidade' }],
    },
    shape: {
      kind: 'tabular',
      columns: ['nome'],
      groupBy: [{ dimension: 'cidade', subtotal: true }],
    },
  };

  const result: ReportResult = {
    ...envelope,
    shape: 'tabular',
    rows: [
      {
        keys: [{ dimension: 'cidade', key: 'Olinda' }],
        values: { quantidade: 1 },
        count: 1,
        level: 0,
        records: [{ id: '2', nome: 'Bruno', cidade: 'Olinda' }],
      },
      {
        keys: [{ dimension: 'cidade', key: 'Recife' }],
        values: { quantidade: 2 },
        count: 2,
        level: 0,
        records: [
          { id: '1', nome: 'Ana', cidade: 'Recife' },
          { id: '3', nome: 'Carla', cidade: 'Recife' },
        ],
      },
    ],
    totals: { values: { quantidade: 3 }, count: 3 },
  };

  it('as COLUNAS continuam sendo os campos, e os registros aparecem', () => {
    draw(spec, result);

    expect(screen.getByText('Nome')).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Bruno')).toBeDefined();
    expect(screen.getByText('Carla')).toBeDefined();
  });

  it('cada grupo abre com o valor do campo e fecha com o total dele', () => {
    draw(spec, result);

    expect(screen.getByText('Recife')).toBeDefined();
    expect(screen.getByText(/table\.total — Recife — Quantidade: 2/)).toBeDefined();
    expect(screen.getByText(/table\.total — Olinda — Quantidade: 1/)).toBeDefined();
  });

  /* O nível que declara `subtotal: false` abre o grupo e não o fecha com número nenhum. */
  it('o nível que não subtotaliza não ganha faixa de total', () => {
    draw(
      { ...spec, shape: { kind: 'tabular', columns: ['nome'], groupBy: [{ dimension: 'cidade', subtotal: false }] } },
      result,
    );

    expect(screen.queryByText(/table\.total — Recife/)).toBeNull();
    expect(screen.getByText('Recife')).toBeDefined();
  });

  it('o total geral continua sendo o rodapé de sempre', () => {
    draw(spec, result);

    expect(screen.getByText(/table\.total — Quantidade: 3/)).toBeDefined();
  });

  it('sem grupo nenhum diz que não há dado, em vez de desenhar uma tabela vazia', () => {
    draw(spec, { ...result, rows: [], totals: null });

    expect(screen.getByText('table.empty')).toBeDefined();
  });
});
