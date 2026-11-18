import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { REPORT_VIEW_NAMESPACE } from './reportViewMessages';

/** **Portuguese (Brazil) for the Report view example** — the translation travels inside the package. */
const REPORT_VIEW_PT_BR: Record<string, string> = {
  'package.name': 'Relatório desenhado em código, pelo exemplo',
  'package.category': 'Relatórios',
  'package.description':
    'Um relatório cuja aba a extensão desenha: botões de período e destaques próprios, acima do gráfico e da tabela da plataforma.',
  'package.summary':
    'Como uma extensão desenha o CORPO de um relatório que ela declara. O relatório nomeia uma das views do pacote (`reports[].view`), e essa view substitui o corpo padrão da aba do relatório onde quer que ele seja aberto — a lista de relatórios, a paleta de comandos, o link de uma notificação. A plataforma mantém o título, os avisos e Exportar / Imprimir / Assinar, e é ela que executa o relatório: a view pede outro período com `useReportFrame().run(...)`, e por isso o que se exporta é o que está na tela. Os números continuam saindo do dataset declarado — a view só decide como mostrá-los.',

  'screen.entry': 'Lançamento',
  'screen.entry.plural': 'Lançamentos',

  'field.label': 'Descrição',
  'field.category': 'Categoria',
  'field.category.standard': 'Padrão',
  'field.category.priority': 'Prioritário',
  'field.category.exception': 'Exceção',
  'field.entryDate': 'Data',
  'field.amount': 'Valor',

  'report.overview': 'Panorama dos lançamentos',
  'report.overview.description': 'Totais por categoria num período, com os destaques acima do gráfico.',
  'dimension.category': 'Categoria',
  'measure.total': 'Total',
  'measure.count': 'Lançamentos',
  'measure.average': 'Média por lançamento',
  'prompt.period': 'Período',

  'view.overview': 'Panorama dos lançamentos',

  'period.this-month': 'Este mês',
  'period.this-year': 'Este ano',
  'period.last-year': 'Ano passado',
  'period.all': 'Todo o período',

  'overview.total': 'Total',
  'overview.count': 'Lançamentos',
  'overview.average': 'Média por lançamento',
  'overview.loading': 'Executando o relatório…',
  'overview.outside': 'Esta view desenha o corpo do relatório Panorama dos lançamentos. Abra o relatório para vê-la.',
};

export const reportViewPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: REPORT_VIEW_NAMESPACE,
    messages: REPORT_VIEW_PT_BR,
  });
