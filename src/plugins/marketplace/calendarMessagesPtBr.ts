import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { CALENDAR_NAMESPACE } from './calendarMessages';

/**
 * **Portuguese (Brazil) for the Calendar** — the translation that travels INSIDE the extension that
 * owns the text.
 *
 * The `com.microteia.locale-pt-br` package translates the kernel; this file translates what belongs
 * to this extension. Same mechanism, same `i18n.messages` contribution — what differs is the OWNER.
 * The kernel does not answer for vocabulary it did not declare, and it must not ask its own language
 * package to carry an extension's keys.
 *
 * Being here is what makes the extension readable in Portuguese with no language package installed
 * at all.
 */
const CALENDAR_PT_BR: Record<string, string> = {
  'package.name': 'Calendário',
  'package.category': 'Produtividade',
  'package.description': 'A agenda do escritório, agnóstica: qualquer extensão põe um item nela e continua dona dele.',
  'package.summary':
    'A agenda do escritório em colunas de dia, com o mês inteiro numa rolagem que abre no dia de hoje. Ela não conhece prazo, audiência nem parcela: qualquer extensão registra um item, continua dona dele e diz o que acontece quando o usuário o arrasta para outro dia.',

  'nav.calendar': 'Calendário',
  'nav.group.schedule': 'Agenda',
  'page.calendar': 'Calendário',

  'screen.singular': 'Item do calendário',
  'screen.plural': 'Calendário',

  'section.item': 'Item',
  'section.dates': 'Datas',
  'section.origin': 'Origem',

  'field.title': 'Título',
  'field.title.placeholder': 'O que aparece no cartão',
  'field.status': 'Situação',
  'field.status.placeholder': 'Selecione a situação...',
  'field.priority': 'Prioridade',
  'field.priority.placeholder': 'Selecione a prioridade...',
  'field.description': 'Descrição',
  'field.description.placeholder': 'Detalhe que aparece no cartão',
  'field.date': 'Data',
  'field.hour': 'Hora',
  'field.finish-date': 'Data da conclusão',
  'field.finish-hour': 'Hora da conclusão',
  'field.origin': 'Coleção de origem',
  'field.origin.placeholder': 'O cadastro de onde o item veio',
  'field.origin-id': 'Registro de origem',

  'lookup.statuses': 'Calendário: Situação',
  'lookup.priorities': 'Calendário: Prioridade',
  'status.pending': 'Pendente',
  'status.closed': 'Concluído',
  'priority.low': 'Baixa',
  'priority.medium': 'Média',
  'priority.high': 'Alta',
  'priority.critical': 'Crítica',

  'point.move.title': 'Ação ao mover um item de dia',
  'point.move.description': 'A ação executada quando um item é arrastado para outro dia. Quem decide o que a mudança significa é a origem.',
  'point.source.title': 'Como uma origem se apresenta na agenda',
  'point.source.description': 'A etiqueta, o subtítulo e as linhas dos cartões que uma origem põe na agenda. Lido quando a agenda é desenhada, então uma mudança alcança os itens que já estão lá.',

  'settings.section.title': 'Calendário',
  'settings.section.description': 'Como a agenda responde aos gestos do usuário.',
  'settings.move-actions': 'Ao arrastar um item para outro dia',
  'settings.move-actions.description':
    'As ações que respondem à mudança de dia, na ordem em que são consultadas. Vale a primeira que atende a origem do item — arrastar não grava nada por conta própria.',
  'settings.sources': 'Origens exibidas na agenda',
  'settings.sources.description':
    'As extensões que põem itens na agenda. Desligar uma esconde os itens dela — ela continua a mantê-los em dia, então religar mostra tudo de novo na hora.',

  'overview.body':
    'O **Calendário** mostra, lado a lado, os dias do mês e o que está marcado em cada um. A rolagem abre no dia de hoje, o cartão é colorido pela prioridade e a legenda embaixo filtra por ela num clique.\n\nA agenda não é dona de nada do que mostra. Cada item pertence ao registro que o criou — um prazo, uma audiência, uma parcela — e é esse registro que o mantém em dia: mudou lá, muda aqui; foi excluído lá, some daqui. Por isso o item não se edita pela agenda, e clicar no cartão leva direto ao registro de origem.\n\nArrastar um cartão para outro dia **pergunta** à extensão dona do item o que fazer. Em Configurações › Calendário você escolhe quais respondem e em que ordem.',
  'overview.adds': 'Adiciona',
  'overview.adds.value': 'Item "Calendário" no menu',
  'overview.shows': 'Mostra',
  'overview.shows.value': 'O mês inteiro, em colunas de dia',
  'overview.filter': 'Filtro',
  'overview.filter.value': 'Por situação, prioridade, data — e o que as extensões acrescentarem',
  'overview.drag': 'Arrastar',
  'overview.drag.value': 'Executa a ação que a origem declarou',
  'overview.origin': 'Origem',
  'overview.origin.value': 'Cada cartão diz de onde vem, e você escolhe quais origens aparecem',
  'overview.banner': 'Sozinha, a agenda abre vazia: quem a preenche são as extensões que registram itens nela, como a de Prazos.',

  'view.screen-missing': 'Tela "Calendário" não encontrada. Instale a extensão para ativá-la.',
  'view.stat.month': 'No mês',
  'view.stat.pending': 'Pendentes',
  'view.stat.closed': 'Concluídos',
  'view.stat.late': 'Atrasados',
  'view.previous-month': 'Mês anterior',
  'view.next-month': 'Próximo mês',
  'view.today': 'Hoje',
  'view.filter.placeholder': 'Filtrar a agenda...',
  'view.legend.priority': 'Prioridade:',
  'view.legend.all': 'Todas',
  'view.legend.origin': 'Origem:',
  'view.move.no-handler': 'Nenhuma extensão responde por este item ao mudar de dia.',
};

export const calendarPtBrContribution = (): Contribution => messageBundleContribution({
  locale: 'pt-BR',
  namespace: CALENDAR_NAMESPACE,
  messages: CALENDAR_PT_BR,
});
