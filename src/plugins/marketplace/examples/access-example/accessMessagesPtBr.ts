import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { ACCESS_NAMESPACE } from './accessMessages';

/** **Portuguese (Brazil) for the Permissions example** — the translation travels inside the package. */
const ACCESS_PT_BR: Record<string, string> = {
  'package.name': 'Permissões, pelo exemplo',
  'package.category': 'Acesso',
  'package.description':
    'O que uma coleção dá de graça, e o que é preciso declarar: um recurso nomeado, duas permissões com o fecho delas, e uma página que só abre para uma.',
  'package.summary':
    'Como uma extensão diz quem pode o quê. A autorização aqui é por PERMISSÃO e nunca por papel: o escritório monta os próprios perfis, e o código só pergunta se uma permissão está com quem age. Instala uma tela — cujas quatro permissões de CRUD a plataforma deriva sozinha —, mais um recurso nomeado para aquilo que não é coleção, duas permissões declaradas com o fecho que cada uma arrasta, e uma página protegida por uma delas.',

  'screen.note': 'Nota',
  'screen.note.plural': 'Notas',
  'field.title': 'Título',
  'field.title.placeholder': 'Sobre o que é esta nota',
  'field.body': 'Conteúdo',
  'field.published': 'Publicada',

  'resource.board': 'Quadro de notas',

  'permission.view': 'Abrir o quadro de notas',
  'permission.view.description':
    'Ver o quadro que lê as notas. Ele não tem como mostrar o que quem o abre não pode ler, então arrasta a leitura das notas junto.',
  'permission.publish': 'Publicar uma nota',
  'permission.publish.description':
    'Marcar uma nota como publicada. Publicar é gravar, então arrasta a leitura e a alteração junto.',

  'nav.board': 'Quadro de notas',
  'page.board': 'Quadro de notas',

  'board.heading': 'Quadro de notas',
  'board.body':
    'Você está vendo esta página porque tem **Abrir o quadro de notas**. Quem não a tem não recebe um erro aqui — o item de menu e a página simplesmente não existem para essa pessoa.\n\nÉ essa a forma inteira da autorização nesta plataforma: **pergunte o que alguém pode FAZER, nunca quem essa pessoa é**. Não há papel a comparar; o escritório monta os próprios perfis e põe permissões dentro deles.',
  'board.free': 'Dadas de graça',
  'board.free.value': 'accessNote.read, accessNote.create, accessNote.update, accessNote.delete',
  'board.declared': 'Declaradas aqui',
  'board.declared.value': 'access-example.view, access-example.publish',
  'board.note':
    'Uma permissão RESTRINGE e nunca concede: ter esta continua não dando nada sobre uma nota que você não pode ler.',
};

export const accessPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: ACCESS_NAMESPACE,
    messages: ACCESS_PT_BR,
  });
