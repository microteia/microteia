import { describe, it, expect } from 'vitest';
import {
  MEASURE_COUNT_KEY,
  bucketsFromLimits,
  limitsOfBuckets,
  movedDimensions,
  operatorNeedsValue,
  reportDesignSectionCounts,
  tabularShapeOf,
  uniqueReportKey,
  withGranularity,
} from './ReportDesign.viewmodel';
import type {
  ReportDimension,
  ReportHighlight,
  ReportMeasure,
  ReportPrompt,
  ReportRelated,
} from '../../../domain/schema/report/reportSpec';
import type { QueryPredicate } from '../../../domain/schema/querySpec';

/**
 * A chave do DOCUMENTO, e o defeito que chegou à tela.
 *
 * Salvar um segundo relatório com o mesmo nome devolvia `artifact.id-taken` — recusa correta do
 * repositório e inútil para quem só quis repetir o nome. O nome é do escritório; a chave é do
 * sistema, e é ela que precisa ceder.
 */
describe('uniqueReportKey', () => {
  it('deriva uma chave legível do nome', () => {
    expect(uniqueReportKey('Faturamento por sócio', new Set())).toBe('faturamento_por_s_cio');
  });

  it('desvia da chave que já existe, em vez de recusar', () => {
    const taken = new Set(['listagem_de_pessoas']);

    expect(uniqueReportKey('Listagem de Pessoas', taken)).toBe('listagem_de_pessoas_2');
  });

  it('continua desviando quando o desvio também está ocupado', () => {
    const taken = new Set(['mensal', 'mensal_2', 'mensal_3']);

    expect(uniqueReportKey('mensal', taken)).toBe('mensal_4');
  });

  it('não devolve chave vazia quando o nome não tem letra nem número', () => {
    // E o padrão é DESTE chamador: um padrão compartilhado com a chave de campo fazia a chave de um
    // relatório sair `campo`, que é nome interno de outra coisa.
    expect(uniqueReportKey('***', new Set())).toBe('report');
  });

  it('corta um nome longo, e o corte não gera colisão silenciosa', () => {
    const longo = 'a'.repeat(200);
    const primeira = uniqueReportKey(longo, new Set());

    expect(primeira.length).toBeLessThanOrEqual(60);
    expect(uniqueReportKey(longo, new Set([primeira]))).toBe(`${primeira}_2`);
  });
});

/**
 * A CHAVE não se traduz.
 *
 * `contagem` foi gravado como chave de medida num relatório real — palavra nossa dentro de um
 * identificador, que é o que viaja no `.json` exportado e o que a dobra referencia. O que traduz é o
 * `label`, e é ele que a tela mostra.
 */
describe('a chave de uma medida', () => {
  it('a contagem se chama `count`, e não `contagem`', () => {
    // Guardado pelo catálogo: se alguém trocar a chave por uma palavra traduzida outra vez, o par
    // rótulo/chave deixa de existir e nada mais reprova.
    expect(MEASURE_COUNT_KEY).toBe('count');
  });
});

/**
 * O operador que NÃO pede valor.
 *
 * `está preenchido` responde sobre a presença do campo, não sobre o conteúdo dele. Pedir um valor ali
 * seria cobrar da pessoa o que a consulta ignora — e o valor digitado sumiria sem explicação.
 */
describe('operatorNeedsValue', () => {
  it('exists dispensa valor', () => {
    expect(operatorNeedsValue('exists')).toBe(false);
  });

  it('todos os outros pedem', () => {
    for (const op of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'contains'] as const) {
      expect(operatorNeedsValue(op), op).toBe(true);
    }
  });
});

/**
 * "Valor exato" REMOVE o corte, em vez de o gravar `undefined`.
 *
 * O defeito chegou à tela como uma recusa do SDK do Firestore — `Unsupported field value:
 * undefined (found in document tenants/.../reports/...)` —, dita sobre um documento que quem estava
 * desenhando o relatório nunca viu. O `spec` é gravado verbatim, então um `undefined` dentro dele
 * derruba a gravação inteira.
 */
describe('withGranularity', () => {
  const dimensions: ReportDimension[] = [
    { key: 'venc', path: 'dueDate', granularity: 'month' },
    { key: 'tipo', path: 'kind' },
  ];

  it('valor exato apaga a chave, e não a deixa como undefined', () => {
    const [venc] = withGranularity(dimensions, 'venc', undefined);

    expect('granularity' in venc).toBe(false);
    // A prova do defeito: `JSON.stringify` esconderia um `undefined`, o Firestore não.
    expect(Object.values(venc).includes(undefined)).toBe(false);
  });

  it('trocar de corte grava o corte novo', () => {
    expect(withGranularity(dimensions, 'venc', 'quarter')[0].granularity).toBe('quarter');
  });

  it('quem tem outra chave não é tocado', () => {
    expect(withGranularity(dimensions, 'venc', undefined)[1]).toBe(dimensions[1]);
  });
});

/**
 * A ORDEM dos agrupamentos é o relatório: ela é a ordem dos níveis do resumo e a das colunas da
 * lista simples. Sem reordenar, trocar dois de lugar exigia remover os dois e declará-los de novo.
 */
describe('movedDimensions', () => {
  const dimensions: ReportDimension[] = [
    { key: 'a', path: 'a' },
    { key: 'b', path: 'b' },
    { key: 'c', path: 'c' },
  ];
  const keys = (list: ReportDimension[] | null): string[] => (list ?? []).map((one) => one.key);

  it('sobe uma posição', () => {
    expect(keys(movedDimensions(dimensions, 'c', 1))).toEqual(['a', 'c', 'b']);
  });

  it('arrastar para o topo leva o item para o topo', () => {
    expect(keys(movedDimensions(dimensions, 'c', 0))).toEqual(['c', 'a', 'b']);
  });

  it('fora da lista nada muda — o botão da ponta não pode inventar uma posição', () => {
    expect(movedDimensions(dimensions, 'a', -1)).toBeNull();
    expect(movedDimensions(dimensions, 'c', 3)).toBeNull();
    expect(movedDimensions(dimensions, 'z', 0)).toBeNull();
  });
});

/**
 * A seção de campos passou a ser o que ela sempre foi na lista: as COLUNAS. O agrupamento é uma
 * escolha à parte — e escolher um campo para agrupar não pode custar a coluna dos outros, que era
 * exatamente o que acontecia quando a única saída para agrupar era trocar a dobra inteira.
 */
describe('tabularShapeOf', () => {
  it('sem agrupamento, todo campo é coluna e não há grupo nenhum', () => {
    expect(tabularShapeOf(['nome', 'cidade'], [])).toEqual({
      kind: 'tabular',
      columns: ['nome', 'cidade'],
    });
  });

  it('o campo que agrupa sai das colunas — os outros continuam onde estavam', () => {
    expect(tabularShapeOf(['nome', 'cidade', 'valor'], ['cidade'])).toEqual({
      kind: 'tabular',
      columns: ['nome', 'valor'],
      groupBy: [{ dimension: 'cidade', subtotal: true }],
    });
  });

  it('todo nível subtotaliza: o total do grupo é a pergunta que o agrupou', () => {
    expect(tabularShapeOf(['nome', 'cidade', 'uf'], ['uf', 'cidade']).groupBy).toEqual([
      { dimension: 'uf', subtotal: true },
      { dimension: 'cidade', subtotal: true },
    ]);
  });

  it('os níveis saem na ORDEM escolhida, e as colunas na ordem dos campos', () => {
    expect(tabularShapeOf(['nome', 'cidade', 'uf', 'valor'], ['uf', 'cidade']).columns)
      .toEqual(['nome', 'valor']);
  });

  it('agrupar por todos os campos deixa a lista sem coluna — a validação recusa, não a tela', () => {
    expect(tabularShapeOf(['cidade'], ['cidade']).columns).toEqual([]);
  });
});

describe('faixas a partir dos limites', () => {
  it('limites viram faixas com rótulos de número e símbolo, na ordem, mais a faixa do resto', () => {
    expect(bucketsFromLimits('60, 30 90')).toEqual([
      { key: 'lt-30', label: '< 30', lt: 30 },
      { key: 'lt-60', label: '30 – 60', lt: 60 },
      { key: 'lt-90', label: '60 – 90', lt: 90 },
      { key: 'ge-90', label: '≥ 90' },
    ]);
  });

  it('limite repetido entra uma vez; nada numérico é sem faixas', () => {
    expect(bucketsFromLimits('30, 30').map((bucket) => bucket.key)).toEqual(['lt-30', 'ge-30']);
    expect(bucketsFromLimits('abc')).toEqual([]);
    expect(bucketsFromLimits('')).toEqual([]);
  });

  it('o campo nasce preenchido com os limites gravados', () => {
    expect(limitsOfBuckets(bucketsFromLimits('30, 60'))).toBe('30, 60');
    expect(limitsOfBuckets(undefined)).toBe('');
  });
});

/**
 * O contador das abas: é ele que diz, sem abrir uma por uma, onde o relatório já declara alguma
 * coisa — inclusive o que o rascunho da IA acabou de preencher fora da aba em que se está.
 */
describe('o contador de cada aba da autoria', () => {
  const empty = {
    dimensions: [] as ReportDimension[],
    measures: [] as ReportMeasure[],
    highlights: [] as ReportHighlight[],
    filters: [] as QueryPredicate[],
    filterExpression: '',
    related: [] as ReportRelated[],
    prompts: [] as ReportPrompt[],
  };

  it('relatório em branco não mostra contador nenhum', () => {
    expect(Object.values(reportDesignSectionCounts(empty)).every((count) => count === 0)).toBe(true);
  });

  it('cada aba conta o que ela mesma declara', () => {
    const counts = reportDesignSectionCounts({
      ...empty,
      dimensions: [{} as ReportDimension, {} as ReportDimension],
      measures: [{} as ReportMeasure],
      highlights: [{} as ReportHighlight],
      filters: [{} as QueryPredicate],
      related: [{} as ReportRelated],
      prompts: [{} as ReportPrompt],
    });

    expect(counts.fields).toBe(2);
    expect(counts.figures).toBe(2);
    expect(counts.filters).toBe(3);
  });

  it('o filtro por expressão conta como um filtro — e só se não estiver em branco', () => {
    expect(reportDesignSectionCounts({ ...empty, filterExpression: '   ' }).filters).toBe(0);
    expect(reportDesignSectionCounts({ ...empty, filterExpression: 'row.total > 10' }).filters).toBe(1);
  });
});
