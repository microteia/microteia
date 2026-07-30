import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../domain/entities/MarketplacePlugin';

/**
 * Plugin de exemplo COMPLETO — o módulo Vendas (produto, venda, item) espelhando um módulo do core,
 * inteiramente declarativo. Prova que uma extensão traz um módulo de domínio real com:
 * relacionamento com entidade fixa (venda → pessoa[core]), relacionamento entre telas do próprio
 * pacote (item → produto, item → venda), campo preenchido ao escolher referência (item.preço vem do
 * produto), campo calculado (item.total = qtd × preço), agregado sobre filhos (venda.total = soma
 * dos itens), validação por expressão/regex, e master-detail (itens como aba da venda).
 *
 * As `key`s são de template; a instalação as reivindica como nome de coleção e reescreve as
 * referências entre telas.
 */

const f = (field: Partial<TemplateField> & Pick<TemplateField, 'key' | 'label' | 'type' | 'order'>): TemplateField => ({
  required: false,
  ...field,
});

const produto: ScreenModuleTemplate = {
  key: 'produto',
  titleSingular: 'Produto',
  titlePlural: 'Produtos',
  icon: 'priceTag',
  titleFieldKey: 'nome',
  sidebarOrder: 200,
  fields: [
    f({ key: 'nome', label: 'Nome', type: 'text', order: 0, required: true, showInList: true }),
    f({
      key: 'codigo',
      label: 'Código',
      type: 'text',
      order: 1,
      required: true,
      showInList: true,
      rules: { validate: { pattern: '^[A-Z0-9-]{2,}$', message: 'Use letras maiúsculas, números e hífen (mín. 2).' } },
    }),
    f({ key: 'preco', label: 'Preço', type: 'currency', order: 2, required: true, showInList: true }),
    f({
      key: 'unidade',
      label: 'Unidade',
      type: 'select',
      order: 3,
      options: [
        { key: 'un', label: 'Unidade' },
        { key: 'kg', label: 'Quilo' },
        { key: 'cx', label: 'Caixa' },
      ],
    }),
  ],
};

const venda: ScreenModuleTemplate = {
  key: 'venda',
  titleSingular: 'Venda',
  titlePlural: 'Vendas',
  icon: 'shoppingBag',
  titleFieldKey: 'numero',
  sidebarOrder: 201,
  // Botão na tela de Venda (detalhe e card da lista) — dispara o workflow síncrono e mostra o
  // retorno. Prova action→workflow ponta a ponta.
  viewActionIds: ['act-venda-resumo'],
  cardActionIds: ['act-venda-resumo'],
  fields: [
    f({ key: 'numero', label: 'Número', type: 'text', order: 0, required: true, showInList: true }),
    // Relacionamento com ENTIDADE FIXA do core — refEntity 'persons' fica intacto na instalação.
    f({ key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'persons', order: 1, required: true, showInList: true }),
    f({ key: 'data', label: 'Data', type: 'date', order: 2, required: true, showInList: true }),
    // Agregado: soma o `total` dos itens cujo campo `venda` aponta para esta venda.
    f({
      key: 'total',
      label: 'Total',
      type: 'currency',
      order: 3,
      showInList: true,
      aggregation: { from: 'item', via: 'venda', op: 'sum', field: 'total' },
    }),
  ],
};

const item: ScreenModuleTemplate = {
  key: 'item',
  titleSingular: 'Item',
  titlePlural: 'Itens',
  icon: 'shoppingBag',
  titleFieldKey: 'produto',
  sidebarOrder: 202,
  // Master-detail: itens aparecem como aba da venda; `venda` é o campo que aponta para o pai.
  parentEntity: 'venda',
  parentFieldKey: 'venda',
  fields: [
    f({ key: 'venda', label: 'Venda', type: 'reference', refEntity: 'venda', order: 0, required: true }),
    // Ao escolher o produto, copia o preço dele para o item (editável depois).
    f({
      key: 'produto',
      label: 'Produto',
      type: 'reference',
      refEntity: 'produto',
      order: 1,
      required: true,
      showInList: true,
      logic: { onChange: "object('preco', produto.preco)" },
    }),
    f({ key: 'qtd', label: 'Quantidade', type: 'number', order: 2, required: true, showInList: true }),
    f({ key: 'preco', label: 'Preço unitário', type: 'currency', order: 3, required: true, showInList: true }),
    // Calculado: total do item = quantidade × preço.
    f({ key: 'total', label: 'Total', type: 'currency', order: 4, showInList: true, logic: { compute: 'qtd * preco' } }),
  ],
};

export const vendasPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.vendas',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Vendas',
    description: 'Módulo de vendas: produtos, vendas e itens, com totais calculados.',
    publisher: { name: 'Microteia' },
  },
  summary:
    'Um módulo de Vendas completo: cadastro de produtos, vendas ligadas a clientes (pessoas), e itens com preço preenchido pelo produto, total por item e total da venda calculados automaticamente.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'O módulo **Vendas** adiciona três telas ao escritório — **Produtos**, **Vendas** e os **Itens** de cada venda — provando que uma extensão pode trazer um módulo de domínio inteiro, com relacionamentos, cálculos e totais automáticos.',
      },
      {
        type: 'grid',
        columns: 3,
        children: [
          { type: 'metric', label: 'Telas', value: '3' },
          { type: 'metric', label: 'Cliente', value: 'Pessoa (core)' },
          { type: 'metric', label: 'Totais', value: 'Automáticos' },
        ],
      },
      { type: 'divider' },
      {
        type: 'keyValue',
        items: [
          { label: 'Preço do item', value: 'Vem do produto escolhido' },
          { label: 'Total do item', value: 'Quantidade × preço' },
          { label: 'Total da venda', value: 'Soma dos itens' },
          { label: 'Estrutura', value: 'Gerenciada pela extensão' },
        ],
      },
      {
        type: 'banner',
        message: 'Você pode adicionar campos próprios às telas; ao remover a extensão, os dados são preservados.',
        variant: 'info',
      },
    ],
  },
  workflows: [
    {
      templateId: 'wf-venda-resumo',
      name: 'Resumo da Venda',
      description: 'Workflow síncrono chamado pela ação "Resumo" na tela de Venda.',
      eventName: 'workflow.called',
      version: 1,
      condition: { kind: 'AlwaysTrue' },
      steps: [
        {
          id: 'montar',
          stepDefinitionId: 'map',
          type: 'Action',
          order: 0,
          enabled: true,
          // "Montar Objeto" sem nome espalha os campos na raiz — a ação lê `status`.
          configuration: {
            map: {
              kind: 'Literal',
              value: {
                name: '',
                fields: [
                  { name: 'status', value: { kind: 'Literal', value: { code: 'SUCCESS', message: 'Resumo da venda gerado com sucesso.' } } },
                ],
              },
            },
          },
        },
      ],
    },
  ],
  actions: [
    {
      templateId: 'act-venda-resumo',
      key: 'venda_resumo',
      title: 'Resumo',
      icon: 'shoppingBag',
      workflowId: 'wf-venda-resumo',
      danger: false,
      enabled: true,
      order: 0,
    },
  ],
  screens: [produto, venda, item],
};
