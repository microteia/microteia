import { describe, it, expect } from 'vitest';
import type { ReportModuleTemplate } from '../../entities/Report';
import type { ReportSpec } from '../../schema/report/reportSpec';
import { reportOutRefs } from './pluginReferences';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { reportCodeViewOf, reportInputFromTemplate, reportTemplateSourceId, rewriteReportTables } from './reportModule';

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'produtos',
    dimensions: [
      { key: 'categoria', path: 'categoria' },
      { key: 'cidade', path: 'fornecedor.cidade' },
    ],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'categoria' }], values: ['total'] },
};

const template: ReportModuleTemplate = {
  templateId: 'vendasPorCategoria',
  key: 'vendas-por-categoria',
  title: '@com.acme.vendas/report.title',
  icon: 'fileChart',
  spec,
  origin: 'plugin',
  sourceRev: 7,
};

describe('rewriteReportTables', () => {
  it('reescreve a coleção para a chave INSTALADA', () => {
    // É a perna que resolve o sufixo. Sem ela, o relatório leria uma coleção vazia — sem erro e sem
    // aviso — no segundo escritório que instalasse duas extensões com a mesma chave de tela.
    const keyMap = new Map([['produtos', 'produtos_2']]);

    expect(rewriteReportTables(spec, keyMap).dataset.table).toBe('produtos_2');
  });

  it('deixa intacto o nome que não está no mapa — coleção do kernel ou de dependência', () => {
    expect(rewriteReportTables(spec, new Map([['outra', 'outra_2']])).dataset.table).toBe('produtos');
  });

  it('NÃO toca nos caminhos — um caminho nunca nomeia coleção', () => {
    // O hop de FK sai do `refEntity` do campo, que a materialização da TELA já reescreveu.
    // Reescrever caminhos aqui seria corromper o que já está certo.
    const rewritten = rewriteReportTables(spec, new Map([
      ['produtos', 'produtos_2'],
      ['fornecedor', 'fornecedor_2'],
    ]));

    expect(rewritten.dataset.dimensions?.map((one) => one.path)).toEqual(['categoria', 'fornecedor.cidade']);
  });

  it('devolve o MESMO objeto quando não há nada a reescrever', () => {
    expect(rewriteReportTables(spec, new Map())).toBe(spec);
  });
});

describe('reportInputFromTemplate', () => {
  const input = reportInputFromTemplate(template, 'com.acme.vendas', new Map([['produtos', 'produtos_2']]), 'u1');

  it('carrega a coleção já reescrita', () => {
    expect(input.spec.dataset.table).toBe('produtos_2');
  });

  it('nasce do plugin, gerenciado, com o refcount de um dono', () => {
    expect(input).toMatchObject({
      origin: 'plugin',
      managed: true,
      ownerPluginId: 'com.acme.vendas',
      ownerPluginIds: ['com.acme.vendas'],
      sourceId: 'vendasPorCategoria',
      sourceRev: 7,
      enabled: true,
    });
  });

  it('não leva o `templateId` para o documento — ele virou `sourceId`', () => {
    expect((input as unknown as Record<string, unknown>).templateId).toBeUndefined();
  });

  it('não leva a `view` para o documento — ela é código do pacote, e fica nele', () => {
    const comView = reportInputFromTemplate({ ...template, view: 'vendas-view' }, 'p', new Map());

    expect((comView as unknown as Record<string, unknown>).view).toBeUndefined();
  });

  it('respeita o `sourceId` declarado, quando ele existe', () => {
    const comSourceId = { ...template, sourceId: 'guid-universal' };

    expect(reportTemplateSourceId(comSourceId)).toBe('guid-universal');
    expect(reportInputFromTemplate(comSourceId, 'p', new Map()).sourceId).toBe('guid-universal');
  });
});

describe('reportOutRefs — o portão do pacote', () => {
  it('emite a coleção que o relatório cobre', () => {
    // Sem esta perna, o relatório viaja apontando para uma coleção que o pacote não leva nem declara
    // em `dependencies`, e a falha aparece SÓ no escritório do cliente.
    expect(reportOutRefs(template)).toEqual([{
      kind: 'screen',
      id: 'produtos',
      from: { origin: '@core.marketplace/ref.origin.report', name: 'vendasPorCategoria' },
    }]);
  });

  it('não emite referência para lista de opções do kernel', () => {
    // `documentTypes` é do núcleo e tem nome GLOBAL: ela não viaja com pacote nenhum, então cobrar
    // uma dependência por ela recusaria um relatório perfeitamente instalável.
    const doKernel = { ...template, spec: { ...spec, dataset: { ...spec.dataset, table: 'documentTypes' } } };

    expect(reportOutRefs(doKernel)).toEqual([]);
  });

  it('não estoura com spec malformado de terceiro', () => {
    const quebrado = { templateId: 'x' } as unknown as ReportModuleTemplate;

    expect(() => reportOutRefs(quebrado)).not.toThrow();
    expect(reportOutRefs(quebrado)).toEqual([]);
  });
});

/**
 * A view que o pacote dono declara para o relatório (#3).
 *
 * A declaração mora no PACOTE: o documento do escritório não a carrega, então a resposta sai de quem o
 * instalou. Quem decide se ela RODA é a confiança de código, conferida depois, no registro de
 * implementações.
 */
describe('reportCodeViewOf', () => {
  const pacote = (patch: Partial<MarketplacePlugin> = {}): MarketplacePlugin => ({
    manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas' },
    workflows: [],
    reports: [{ ...template, view: 'vendas-view' }],
    views: [{ key: 'vendas-view', source: 'export default () => null;' }],
    ...patch,
  } as MarketplacePlugin);

  const instalado = {
    origin: 'plugin' as const,
    ownerPluginId: 'com.acme.vendas',
    ownerPluginIds: ['com.acme.vendas'],
    sourceId: 'vendasPorCategoria',
  };

  it('acha a view pelo `sourceId` do relatório, no pacote do dono', () => {
    expect(reportCodeViewOf(instalado, () => pacote()))
      .toEqual({ pluginId: 'com.acme.vendas', viewKey: 'vendas-view' });
  });

  it('o relatório sem `view` fica com o corpo padrão', () => {
    expect(reportCodeViewOf(instalado, () => pacote({ reports: [template] }))).toBeNull();
  });

  it('a `view` que não está em `views` não aponta para nada', () => {
    expect(reportCodeViewOf(instalado, () => pacote({ views: [] }))).toBeNull();
  });

  it('o relatório do escritório e o pessoal nunca trocam de corpo', () => {
    expect(reportCodeViewOf({ ...instalado, origin: 'design' }, () => pacote())).toBeNull();
    expect(reportCodeViewOf({ ...instalado, ownerId: 'u1' }, () => pacote())).toBeNull();
  });

  it('sem o pacote instalado, não há view', () => {
    expect(reportCodeViewOf(instalado, () => undefined)).toBeNull();
  });

  it('entre vários donos, vale o primeiro que declara', () => {
    const outro = pacote({
      manifest: { id: 'com.acme.outro', version: '1.0.0', kernel: '^2.0.0', name: 'Outro' },
      reports: [template],
    } as Partial<MarketplacePlugin>);
    const packages: Record<string, MarketplacePlugin> = { 'com.acme.outro': outro, 'com.acme.vendas': pacote() };

    expect(reportCodeViewOf(
      { ...instalado, ownerPluginId: 'com.acme.outro', ownerPluginIds: ['com.acme.outro', 'com.acme.vendas'] },
      (id) => packages[id],
    )).toEqual({ pluginId: 'com.acme.vendas', viewKey: 'vendas-view' });
  });
});
