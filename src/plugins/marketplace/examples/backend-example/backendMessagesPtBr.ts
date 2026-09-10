import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { BACKEND_NAMESPACE } from './backendMessages';

/** **Portuguese (Brazil) for the Cloud Functions example** — the translation travels in the package. */
const BACKEND_PT_BR: Record<string, string> = {
  'package.name': 'Cloud Functions, pelo exemplo',
  'package.category': 'Backend',
  'package.description':
    'Uma callable, um gatilho do Firestore e uma rotina noturna — cada um com o guarda que a forma dele exige —, mais o backend que a extensão pede ao projeto.',
  'package.summary':
    'O que uma extensão precisa quando declarar não basta e algum código tem de rodar no servidor. Ela traz três Cloud Functions próprias, uma de cada forma, e cada uma nasce com o guarda que aquela forma exige: uma callable recusa quem não é membro daquele escritório, um gatilho de documento recusa disparar onde a extensão nunca foi instalada, e uma rotina agendada percorre os escritórios que a têm. Também declara o que precisa do projeto Firebase — as functions, um parâmetro, um índice e um passo que uma pessoa dá à mão.',

  'screen.ticket': 'Chamado',
  'screen.ticket.plural': 'Chamados',
  'field.subject': 'Assunto',
  'field.subject.placeholder': 'Sobre o que é este chamado',
  'field.amount': 'Valor',
  'field.status': 'Situação',
  'field.status.open': 'Aberto',
  'field.status.closed': 'Fechado',
  'field.openedAt': 'Aberto em',

  'prerequisite.scheduler.title': 'Habilitar o Cloud Scheduler no projeto',
  'prerequisite.scheduler.detail':
    'A rotina noturna exige o Cloud Scheduler habilitado e uma conta de faturamento no projeto Firebase, e depois um valor em BACKEND_EXAMPLE_RATE nas configurações de backend. Configurações nunca são compartilhadas entre instalações.',
};

export const backendPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: BACKEND_NAMESPACE,
    messages: BACKEND_PT_BR,
  });
