import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { nav, page } from '../contributionBuilders';
import KANBAN_SOURCE from './views/kanbanCases/KanbanCases.view.tsx?raw';

/**
 * "Kanban de Processos" — a PRIMEIRA extensão de CÓDIGO (trusted). A view abaixo é entregue como
 * FONTE (string), compilada e avaliada pelo runtime do browser contra a API curada do host — o
 * Kernel não a interpreta. Escrita só contra `@microteia/ui`, `@microteia/data`, `react` e
 * `styled-components`; nenhum import do app. Por vir do bundle (fonte confiável), executa; um `.json`
 * importado avulso com esta mesma fonte NÃO executaria até ser publicado por um SYSTEM.
 *
 * Como é código-em-string, não passa por tsc/eslint: usa estilos inline lidos do tema (a regra de
 * styled-components vale para arquivos do app, não para a fonte de uma extensão) e evita crases para
 * aninhar neste template literal.
 */

export const kanbanCasesPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.kanban-processos',
    version: '1.1.0',
    kernel: '^1.0.0',
    name: 'Kanban de Processos',
    description: 'Uma visão Kanban dos processos, com uma coluna por Fase e arrastar-para-mover.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({ key: 'kanban-processos', label: 'Kanban de Processos', icon: 'layoutGrid', order: 104 }),
      page({ key: 'kanban-processos', title: 'Kanban de Processos', icon: 'layoutGrid' }, 'kanban'),
    ],
  },
  summary:
    'Visão Kanban dos processos: cada coluna é uma Fase, com filtro geral acima e arrastar o cartão entre colunas para mudar a fase do processo. Um exemplo de extensão que traz a própria tela em código.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Kanban de Processos** adiciona uma nova visão dos processos do escritório em formato de quadro: **cada coluna é uma Fase**, e cada processo aparece na coluna da sua fase atual.\n\nUse o **filtro geral** no topo (por advogado, área ou status) para focar o quadro, e **arraste um cartão** de uma coluna para outra para mudar a fase do processo — o sistema salva a mudança na hora.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Kanban de Processos" no menu' },
          { label: 'Colunas', value: 'Uma por Fase (você escolhe quais)' },
          { label: 'Ação', value: 'Arrastar cartão muda a Fase' },
        ],
      },
      {
        type: 'banner',
        message: 'As colunas e o filtro que você escolher ficam salvos apenas para você, neste navegador.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  views: [
    {
      key: 'kanban',
      title: 'Kanban de Processos',
      icon: 'layoutGrid',
      source: KANBAN_SOURCE,
    },
  ],
};
