import { describe, it, expect } from 'vitest';
import { createSchemaContext } from '../pathResolver';
import type { SchemaScreen } from '../pathResolver';
import type { ReportSpec } from './reportSpec';
import {
  hasBlockingReportIssue,
  validateReportSpec,
  validateReportSpecShape,
} from './validateReportSpec';
import type { ReportSpecIssue } from './validateReportSpec';

const personsScreen: SchemaScreen = {
  id: 'persons',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [{ key: 'cidade', label: 'Cidade', type: 'text', required: false, order: 0, origin: 'design' }],
};

const lancamentosScreen: SchemaScreen = {
  id: 'lancamentos',
  titleSingular: 'Lançamento',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 2, origin: 'design' },
    { key: 'vencimento', label: 'Vencimento', type: 'date', required: false, order: 3, origin: 'design' },
    {
      key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'persons',
      refDenormKey: 'cliente', required: false, order: 4, origin: 'design',
    },
    {
      key: 'participanteIds', label: 'Participantes', type: 'reference', refEntity: 'persons',
      multi: true, required: false, order: 5, origin: 'design',
    },
  ],
};

const schema = createSchemaContext([personsScreen, lancamentosScreen], []);
const ctx = { schema };

const valid: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [{ key: 'situacao', path: 'situacao', label: 'Situação' }],
    measures: [{ key: 'total', label: 'Total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
};

const errors = (issues: ReportSpecIssue[]): string[] =>
  issues.filter((issue) => (issue.severity ?? 'error') === 'error').map((issue) => issue.error);

const warnings = (issues: ReportSpecIssue[]): string[] =>
  issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.error);

describe('validateReportSpec — o caminho feliz', () => {
  it('aceita um relatório bem formado', () => {
    expect(validateReportSpec(valid, ctx)).toEqual([]);
  });

  it('nunca lança, com qualquer entrada malformada', () => {
    const lixo = { v: 1, dataset: {}, shape: {} } as unknown as ReportSpec;
    expect(() => validateReportSpec(lixo, ctx)).not.toThrow();
    expect(() => validateReportSpecShape(lixo)).not.toThrow();
  });
});

describe('validateReportSpec — a fronteira entre as camadas', () => {
  it('retirar `presentation` inteiro deixa o spec válido', () => {
    // A REGRA DA CAMADA, como teste: `presentation` só pode conter o que, removido, deixa um
    // relatório correto. Uma regra que só existe na prosa erode — em dois anos esta camada teria um
    // campo que muda um número, e nada reprovaria.
    const semAparencia: ReportSpec = {
      ...valid,
      presentation: {
        chart: { kind: 'bar', category: 'situacao', series: ['total'] },
        fields: { total: { align: 'end' } },
        export: { csv: true },
      },
    };

    // Nenhum ERRO vem da aparência: o que ela declara e este kernel ainda não lê vira AVISO, que é
    // o caminho pelo qual `presentation.fields` deixou de ser um no-op silencioso.
    expect(validateReportSpec(semAparencia, ctx)
      .filter((issue) => (issue.severity ?? 'error') === 'error')).toEqual([]);
    expect(validateReportSpec({ ...semAparencia, presentation: undefined }, ctx)).toEqual([]);
  });

  it('a propriedade de aparência que este kernel não lê AVISA, em vez de não fazer nada', () => {
    // Era o pior dos dois mundos: o autor declarava `fields`, `drillDown`, `shape.limit` ou um
    // filtro obrigatório, nada acontecia, e nada em lugar nenhum dizia por quê.
    const issues = validateReportSpec({
      ...valid,
      presentation: {
        fields: { total: { align: 'end' } },
        drillDown: { enabled: true },
        prompts: [{ key: 'situacao', path: 'situacao', op: 'eq', required: true }],
      },
    }, ctx);

    expect(issues.map((issue) => issue.errorParams?.capability).filter(Boolean).sort()).toEqual([
      'presentation.drilldown',
      'presentation.fields',
      'presentation.prompt.required',
    ]);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});

describe('validateReportSpec — os três níveis de recusa', () => {
  it('versão desconhecida recusa o relatório inteiro, sem olhar dentro', () => {
    const issues = validateReportSpec({ ...valid, v: 2 }, ctx);

    expect(issues).toEqual([{
      field: 'v',
      error: '@core.reports/spec.version.unsupported',
      errorParams: { version: '2' },
    }]);
  });

  it('operação de medida desconhecida é RECUSA, nunca degradação', () => {
    // Descartar a medida mostraria um número diferente com o mesmo nome — a única perda que o leitor
    // não tem como notar. Por isso `dataset` é nível 3 e `presentation` é nível 1.
    const spec = {
      ...valid,
      dataset: { ...valid.dataset, measures: [{ key: 'total', op: 'median', path: 'valor' }] },
    } as unknown as ReportSpec;

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/measure.op.unsupported');
  });

  it('dobra desconhecida DEGRADA com aviso, e não recusa', () => {
    const spec = { ...valid, shape: { kind: 'funnel' } } as unknown as ReportSpec;
    const issues = validateReportSpec(spec, ctx);

    expect(warnings(issues)).toContain('@core.reports/shape.kind.unsupported');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });

  it('granularidade desconhecida avisa, e o relatório continua correto pelo valor cru', () => {
    const spec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        dimensions: [{ key: 'quinzena', path: 'vencimento', granularity: 'fortnight' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'quinzena' }], values: ['total'] },
    } as unknown as ReportSpec;
    const issues = validateReportSpec(spec, ctx);

    expect(warnings(issues)).toContain('@core.reports/dimension.granularity.unsupported');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });

  it('capacidade que este kernel não tem recusa pelo NOME dela', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        measures: [{ key: 'ticket', kind: 'computed', expression: 'a / b' }],
      },
    };
    const issues = validateReportSpec(spec, ctx);

    expect(issues[0]).toMatchObject({
      error: '@core.reports/spec.capability.unsupported',
      errorParams: { capability: 'measure.computed' },
    });
  });
});

describe('validateReportSpec — a coerência entre as camadas', () => {
  it('recusa dobra que cita dimensão inexistente', () => {
    const spec: ReportSpec = {
      ...valid,
      shape: { kind: 'summary', groupBy: [{ dimension: 'inexistente' }], values: ['total'] },
    };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/shape.dimension.unknown');
  });

  it('recusa dobra que cita medida inexistente', () => {
    const spec: ReportSpec = {
      ...valid,
      shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['inexistente'] },
    };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/shape.measure.unknown');
  });

  it('recusa uma MEDIDA como coluna de relatório tabular', () => {
    const spec: ReportSpec = { ...valid, shape: { kind: 'tabular', columns: ['total'] } };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/shape.tabular.measure');
  });

  it('recusa pivô sem linha ou sem coluna', () => {
    const spec: ReportSpec = {
      ...valid,
      shape: { kind: 'matrix', rows: [{ dimension: 'situacao' }], columns: [], values: ['total'] },
    };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/shape.matrix.incomplete');
  });

  it('avisa que o segundo nível de coluna do pivô é achatado nesta versão', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        dimensions: [
          { key: 'situacao', path: 'situacao' },
          { key: 'mes', path: 'vencimento', granularity: 'month' },
        ],
      },
      shape: {
        kind: 'matrix',
        rows: [{ dimension: 'situacao' }],
        columns: [{ dimension: 'mes' }, { dimension: 'situacao' }],
        values: ['total'],
      },
    };

    expect(warnings(validateReportSpec(spec, ctx))).toContain('@core.reports/shape.matrix.levels-flattened');
  });

  it('dimensões e medidas partilham UM espaço de nomes', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        measures: [{ key: 'situacao', op: 'count' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['situacao'] },
    };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/key.duplicated');
  });

  it('avisa que a lista simples não tem o que o gráfico plote, sem derrubar o relatório', () => {
    const spec: ReportSpec = {
      ...valid,
      shape: { kind: 'tabular', columns: ['situacao'] },
      presentation: { chart: { kind: 'bar' } },
    };
    const issues = validateReportSpec(spec, ctx);

    expect(warnings(issues)).toContain('@core.reports/chart.shape.tabular');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });

  it('não avisa da dobra quando o relatório agrupa', () => {
    const spec: ReportSpec = { ...valid, presentation: { chart: { kind: 'bar' } } };

    expect(warnings(validateReportSpec(spec, ctx))).not.toContain('@core.reports/chart.shape.tabular');
  });

  it('avisa quando o gráfico cita chave que não existe, sem derrubar o relatório', () => {
    const spec: ReportSpec = {
      ...valid,
      presentation: { chart: { kind: 'bar', category: 'inexistente' } },
    };
    const issues = validateReportSpec(spec, ctx);

    expect(warnings(issues)).toContain('@core.reports/chart.key.unknown');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });
});

describe('validateReportSpec — o esquema do escritório', () => {
  it('recusa nomeando a tabela que nenhuma tela descreve', () => {
    const spec: ReportSpec = { ...valid, dataset: { ...valid.dataset, table: 'sumiu' } };

    expect(validateReportSpec(spec, ctx)).toContainEqual({
      field: 'dataset.table',
      error: '@core.reports/dataset.table.unknown',
      errorParams: { table: 'sumiu' },
    });
  });

  it('recusa caminho de dimensão que não resolve, reusando o erro do resolvedor', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, dimensions: [{ key: 'situacao', path: 'titulo.foo' }] },
    };

    expect(hasBlockingReportIssue(validateReportSpec(spec, ctx))).toBe(true);
  });

  it('tolera a chave que o esquema não conhece — a MESMA tolerância da automação', () => {
    // `resolvePath` aceita um nome que nenhuma tela declara, porque o documento de uma tela dinâmica
    // pode carregá-lo. O relatório herda essa tolerância de propósito: cobrar aqui mais do que o
    // passo "Buscar Registros" cobra criaria duas verdades sobre o mesmo caminho.
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, dimensions: [{ key: 'extra', path: 'campoLivre' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'extra' }], values: ['total'] },
    };

    expect(validateReportSpec(spec, ctx)).toEqual([]);
  });

  it('aceita caminho que atravessa relação', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, dimensions: [{ key: 'cidade', path: 'cliente.cidade' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cidade' }], values: ['total'] },
    };

    expect(validateReportSpec(spec, ctx)).toEqual([]);
  });

  it('aceita o campo de cada apontado quando a relação é de VÁRIOS', () => {
    // Era o único jeito de a pergunta ser feita: uma referência de vários só respondia pelo nome do
    // apontado, e pedir o CPF de cada um recusava o relatório inteiro pedindo a posição do item.
    const spec: ReportSpec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        dimensions: [{ key: 'cidades', path: 'participanteIds.cidade' }],
        where: [{ path: 'participanteIds.cidade', op: 'eq', value: { kind: 'Literal', value: 'Recife' } }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cidades' }], values: ['total'] },
      presentation: { prompts: [{ key: 'cidade', path: 'participanteIds.cidade', op: 'eq' }] },
    };

    expect(validateReportSpec(spec, ctx)).toEqual([]);
  });

  it('soma sobre campo não numérico é AVISO, não recusa', () => {
    // `applyAggregationOp` coage e devolve 0 — uma soma que parece número e não é, o pior sintoma,
    // e por isso precisa gritar. Recusar mataria o caso legítimo do numérico gravado como texto.
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, measures: [{ key: 'total', op: 'sum', path: 'titulo' }] },
    };
    const issues = validateReportSpec(spec, ctx);

    expect(warnings(issues)).toContain('@core.reports/measure.path.not-numeric');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });

  it('balde de data sobre campo que não é data é aviso', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: {
        ...valid.dataset,
        dimensions: [{ key: 'situacao', path: 'situacao', granularity: 'month' }],
      },
    };

    expect(warnings(validateReportSpec(spec, ctx))).toContain('@core.reports/dimension.granularity.not-date');
  });

  it('recusa medida agregada sem caminho quando a operação exige um', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, measures: [{ key: 'total', op: 'sum' }] },
    };

    expect(errors(validateReportSpec(spec, ctx))).toContain('@core.reports/measure.path.missing');
  });

  it('`count` dispensa caminho', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, measures: [{ key: 'total', op: 'count' }] },
    };

    expect(validateReportSpec(spec, ctx)).toEqual([]);
  });

  it('teto pedido acima do permitido GRAMPEIA e avisa, nunca recusa', () => {
    // Quem pede dez mil linhas deve receber o teto com o aviso de que é parcial, e não um relatório
    // que não abre.
    const spec: ReportSpec = { ...valid, dataset: { ...valid.dataset, scanLimit: 10000 } };
    const issues = validateReportSpec(spec, { schema, scanCeiling: 2000 });

    expect(issues).toContainEqual({
      field: 'dataset.scanLimit',
      error: '@core.reports/limit.clamped',
      errorParams: { asked: '10000', allowed: '2000' },
      severity: 'warning',
    });
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });
});

describe('validateReportSpecShape — o que o empacotamento consegue cobrar', () => {
  it('cobra a forma sem nenhum esquema de escritório', () => {
    // No `microteia pack` não existe escritório — não há SchemaContext, e não pode haver. Embarcar
    // um retrato do esquema no pacote é a tentação a recusar: o esquema do escritório é dele.
    const spec: ReportSpec = {
      ...valid,
      shape: { kind: 'summary', groupBy: [{ dimension: 'fantasma' }], values: ['total'] },
    };

    expect(errors(validateReportSpecShape(spec))).toContain('@core.reports/shape.dimension.unknown');
  });

  it('não tenta resolver caminho, porque ali não há contra o que resolver', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, dimensions: [{ key: 'x', path: 'nao.existe.aqui' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'x' }], values: ['total'] },
    };

    expect(validateReportSpecShape(spec)).toEqual([]);
  });

  it('recusa chave que não é identificador', () => {
    const spec: ReportSpec = {
      ...valid,
      dataset: { ...valid.dataset, dimensions: [{ key: 'com espaço', path: 'situacao' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'com espaço' }], values: ['total'] },
    };

    expect(errors(validateReportSpecShape(spec))).toContain('@core.reports/key.invalid');
  });

  it('recusa permissão própria que não é um identificador de permissão', () => {
    const spec: ReportSpec = { ...valid, access: { permission: 'sem-ponto' } };

    expect(errors(validateReportSpecShape(spec))).toContain('@core.reports/access.permission.invalid');
  });

  it('agendamento declarado avisa que ainda não é executado', () => {
    const spec: ReportSpec = { ...valid, schedule: { cron: '0 3 * * *' } };
    const issues = validateReportSpecShape(spec, [...['dataset.collection', 'measure.aggregate', 'shape.summary', 'schedule']]);

    expect(warnings(issues)).toContain('@core.reports/schedule.not-implemented');
  });
});

/**
 * O RELATÓRIO QUE A AUTORIA MONTA SEM TERMINAR.
 *
 * Uma lista simples com o cadastro escolhido, o nome digitado e mais nada. A tela precisa DIZER o
 * que falta: sem estas recusas, o botão de salvar ficava desabilitado sem nada explicando por quê —
 * e a pré-visualização voltava vazia sobre uma coleção cheia.
 */
describe('validateReportSpec — o que a autoria ainda não terminou', () => {
  const meioCaminho: ReportSpec = {
    v: 1,
    dataset: { table: 'lancamentos', dimensions: [], measures: [] },
    shape: { kind: 'tabular', columns: [] },
  };

  it('diz que falta o NÚMERO — um relatório sem ele não tem o que dizer', () => {
    expect(errors(validateReportSpec(meioCaminho, ctx))).toContain('@core.reports/dataset.no-measure');
  });

  it('diz que a lista simples está sem COLUNA', () => {
    expect(errors(validateReportSpec(meioCaminho, ctx))).toContain('@core.reports/shape.tabular.no-columns');
  });

  it('para de reclamar quando as duas coisas estão lá', () => {
    const completo: ReportSpec = {
      v: 1,
      dataset: {
        table: 'lancamentos',
        dimensions: [{ key: 'situacao', path: 'situacao' }],
        measures: [{ key: 'contagem', op: 'count' }],
      },
      shape: { kind: 'tabular', columns: ['situacao'] },
    };

    expect(validateReportSpec(completo, ctx)).toEqual([]);
  });

  it('a dobra agrupada também exige número', () => {
    const semNumero: ReportSpec = {
      v: 1,
      dataset: { table: 'lancamentos', dimensions: [{ key: 'situacao', path: 'situacao' }], measures: [] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: [] },
    };

    expect(errors(validateReportSpec(semNumero, ctx))).toContain('@core.reports/dataset.no-measure');
  });
});

/**
 * O SPEC INTEIRO que a autoria pode montar hoje: filtro fixo, gráfico e filtros do leitor.
 *
 * A tela e o servidor rodam a MESMA função, então este teste é o que garante que não existe um
 * relatório que a autoria deixa salvar e a execução recusa.
 */
describe('validateReportSpec — o que a autoria monta por inteiro', () => {
  const completo: ReportSpec = {
    v: 1,
    dataset: {
      table: 'lancamentos',
      where: [{ path: 'situacao', op: 'neq', value: { kind: 'Literal', value: 'cancelado' } }],
      dimensions: [
        { key: 'situacao', path: 'situacao', label: 'Situação' },
        { key: 'vencimento_month', path: 'vencimento', granularity: 'month' },
      ],
      measures: [
        { key: 'count', op: 'count', label: 'Quantidade' },
        { key: 'valor_sum', op: 'sum', path: 'valor', label: 'Soma de Valor' },
      ],
    },
    shape: {
      kind: 'summary',
      groupBy: [{ dimension: 'situacao', subtotal: true }, { dimension: 'vencimento_month' }],
      values: ['count', 'valor_sum'],
    },
    presentation: {
      chart: { kind: 'bar', category: 'vencimento_month', series: ['valor_sum'], stacked: true },
      prompts: [{ key: 'vencimento_gte', path: 'vencimento', op: 'gte', label: 'Vencimento a partir de' }],
    },
  };

  it('é aceito sem uma queixa', () => {
    expect(validateReportSpec(completo, ctx)).toEqual([]);
  });

  it('o filtro fixo passa pelo MESMO verificador do passo de consulta', () => {
    const comCaminhoRuim: ReportSpec = {
      ...completo,
      dataset: { ...completo.dataset, where: [{ path: 'titulo.foo', op: 'eq', value: { kind: 'Literal', value: 'x' } }] },
    };

    expect(hasBlockingReportIssue(validateReportSpec(comCaminhoRuim, ctx))).toBe(true);
  });

  it('o filtro fixo sem valor, num operador que exige valor, é recusado', () => {
    const semValor: ReportSpec = {
      ...completo,
      dataset: { ...completo.dataset, where: [{ path: 'situacao', op: 'eq' }] },
    };

    expect(errors(validateReportSpec(semValor, ctx)))
      .toContain('@core.automation/query.filter-value.missing');
  });

  it('o filtro do LEITOR com caminho que não resolve é recusado', () => {
    const promptRuim: ReportSpec = {
      ...completo,
      presentation: { prompts: [{ key: 'x', path: 'titulo.foo', op: 'eq' }] },
    };

    expect(hasBlockingReportIssue(validateReportSpec(promptRuim, ctx))).toBe(true);
  });

  it('o gráfico que cita medida inexistente AVISA, e o relatório continua valendo', () => {
    const graficoRuim: ReportSpec = {
      ...completo,
      presentation: { chart: { kind: 'bar', series: ['fantasma'] } },
    };
    const issues = validateReportSpec(graficoRuim, ctx);

    expect(warnings(issues)).toContain('@core.reports/chart.key.unknown');
    expect(hasBlockingReportIssue(issues)).toBe(false);
  });
});
