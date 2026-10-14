import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { BUSINESS_DAYS_NAMESPACE } from './businessDaysMessages';

/**
 * **Portuguese (Brazil) for Business days** — the translation that travels INSIDE the extension that
 * owns the text, like the Calendar's. The kernel's language package translates the kernel; this one
 * translates what belongs to this extension.
 */
const BUSINESS_DAYS_PT_BR: Record<string, string> = {
  'package.name': 'Dias úteis',
  'package.category': 'Produtividade',
  'package.description':
    'Calendários de dias úteis: o escritório marca, ano a ano, os dias que não são úteis, e toda fórmula conta com eles.',
  'package.summary':
    'Mantenha um ou mais calendários de dias úteis — nacional, regional, de um cliente ou de um tribunal — e marque, numa grade dos doze meses, os dias que não são úteis. As fórmulas contam com a união dos calendários que o registro informa: um dia que não é útil em qualquer um deles não é útil na conta.',

  'nav.business-days': 'Dias úteis',
  'nav.group.schedule': 'Agenda',
  'page.business-days': 'Dias úteis',

  'screen.singular': 'Calendário de dias úteis',
  'screen.plural': 'Calendários de dias úteis',
  'section.calendar': 'Calendário',
  'field.name': 'Nome',
  'field.name.placeholder': 'Como o escritório chama este calendário',
  'field.key': 'Chave',
  'field.key.placeholder': 'O que uma fórmula escreve para citá-lo, ex.: nacional',

  'overview.body':
    'Um **calendário** tem os dias da semana que nunca são úteis e, para cada ano, os dias que também não são. Você os marca numa grade dos doze meses — clique num dia, ou arraste por um período.\n\nUma fórmula cita um ou mais calendários e conta com todos eles: `addBusinessDays(inicio, 15, ["nacional", "estadual"])`. Um dia que não é útil em QUALQUER um deles é pulado. Um ano que nunca foi cadastrado não conta como ano sem feriados: a conta para e diz qual calendário não tem qual ano.',
  'overview.adds': 'Acrescenta',
  'overview.adds.value': 'Um item "Dias úteis" no menu',
  'overview.formulas': 'Fórmulas',
  'overview.formulas.value': 'addBusinessDays, businessDaysBetween, isBusinessDay, nextBusinessDay',
  'overview.years': 'Anos',
  'overview.years.value': 'Cada calendário guarda os próprios anos; copiar um ano começa o seguinte',
  'overview.banner':
    'Copiar um ano repete o mesmo dia e mês. Feriados que mudam de data todo ano precisam ser revisados depois da cópia.',

  'view.screen-missing': 'Tela "Calendários de dias úteis" não encontrada. Instale a extensão para ativá-la.',
  'view.calendars': 'Calendários',
  'view.empty': 'Nenhum calendário ainda. Crie o primeiro para começar a marcar os dias.',
  'view.new-calendar': 'Novo calendário',
  'view.new-calendar.name': 'Novo calendário',
  'view.select': 'Selecione um calendário à esquerda para marcar os dias dele.',
  'view.name': 'Nome',
  'view.key': 'Chave',
  'view.key.hint': 'As fórmulas citam o calendário por esta chave.',
  'view.key.invalid': 'A chave usa letras, números, "-" e "_", começando por letra ou número.',
  'view.key.taken': 'Outro calendário já usa a chave "{key}".',
  'view.weekend': 'Nunca são úteis',
  'view.years': 'Anos',
  'view.no-years': 'Este calendário ainda não tem nenhum ano. Acrescente um para começar a marcar os dias.',
  'view.add-year': 'Acrescentar {year}',
  'view.copy-year': 'Copiar para {year}',
  'view.copy-year.done': 'Os dias de {from} foram copiados para {to}. Revise os feriados que mudam de data todo ano.',
  'view.remove-year': 'Remover {year}',
  'view.remove-year.title': 'Remover o ano {year}?',
  'view.remove-year.message': 'As contas que chegarem a {year} vão parar e dizer que o ano não está cadastrado.',
  'view.marked': '{count} dias marcados em {year}',
  'view.legend.off': 'Dia não útil',
  'view.legend.weekend': 'Dia da semana nunca útil',
  'view.save': 'Salvar',
  'view.saved': 'Calendário salvo.',
  'view.discard': 'Descartar alterações',
  'view.delete': 'Excluir calendário',
  'view.delete.title': 'Excluir o calendário "{name}"?',
  'view.delete.message': 'As fórmulas que o citam vão parar e dizer que o calendário não existe.',
  'view.delete.confirm': 'Excluir',
  'view.remove.confirm': 'Remover',
  'view.cancel': 'Cancelar',
  'view.failed': 'Não foi possível salvar o calendário.',
};

export const businessDaysPtBrContribution = (): Contribution => messageBundleContribution({
  locale: 'pt-BR',
  namespace: BUSINESS_DAYS_NAMESPACE,
  messages: BUSINESS_DAYS_PT_BR,
});
