import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { REPORT_NAMESPACE } from './reportMessages';

/**
 * **Portuguese (Brazil) for the Reports example** — the translation that travels INSIDE the extension
 * that owns the text. The kernel does not answer for vocabulary it did not declare, and neither does
 * the language pack: whoever brings the words brings the translation of the words.
 */
const REPORT_PT_BR: Record<string, string> = {
  'package.name': 'Relatórios, pelo exemplo',
  'package.category': 'Relatórios',
  'package.description':
    'Quatro relatórios sobre uma tela pequena: uma lista agrupada, um resumo com gráfico, um pivô, e um que filtra por expressão e pergunta antes de rodar.',
  'package.summary':
    'O que um relatório declarativo consegue dizer, sem negócio no caminho. Instala uma tela e quatro relatórios sobre ela, para que cada dobra possa ser lida como fonte: uma lista quebrada em grupos com subtotais, um resumo em baldes de mês com um gráfico ao lado, um pivô de categoria contra mês, e uma lista que filtra por uma expressão sobre cada linha e pede uma data ao leitor antes de rodar.',

  'screen.entry': 'Lançamento',
  'screen.entry.plural': 'Lançamentos',
  'section.entry': 'Lançamento',
  'section.amounts': 'Valores',
  'field.label': 'Descrição',
  'field.label.placeholder': 'O que é este lançamento',
  'field.category': 'Categoria',
  'field.category.standard': 'Comum',
  'field.category.priority': 'Prioritário',
  'field.category.exception': 'Excepcional',
  'field.amount': 'Valor',
  'field.estimate': 'Previsto',
  'field.entryDate': 'Data',
  'field.archived': 'Arquivado',

  'report.by-category': 'Lançamentos por categoria',
  'report.by-category.description':
    'A lista agrupada: cada lançamento continua visível, quebrado em um bloco por categoria, com um subtotal sob cada bloco.',

  'report.by-month': 'Totais por mês',
  'report.by-month.description':
    'O resumo: uma linha por mês, com um gráfico ao lado. O mês é um BALDE recortado da data, não um campo que alguém digita.',

  'report.category-by-month': 'Categoria contra mês',
  'report.category-by-month.description':
    'O pivô: categorias na lateral, meses no topo, um total em cada célula.',

  'report.over-estimate': 'Acima do previsto',
  'report.over-estimate.description':
    'A lista que nenhum filtro fixo escreve: mantém as linhas cujo valor passou do próprio previsto, e pede antes uma data inicial ao leitor.',

  'measure.total': 'Total',
  'measure.count': 'Lançamentos',
  'measure.open-total': 'Total em aberto',
  'measure.categories': 'Categorias',

  'dimension.label': 'Descrição',
  'dimension.category': 'Categoria',
  'dimension.date': 'Data',
  'dimension.month': 'Mês',

  'prompt.from': 'A partir de',
};

export const reportPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: REPORT_NAMESPACE,
    messages: REPORT_PT_BR,
  });
