import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { RECORD_TAB_NAMESPACE } from './recordTabMessages';

/** **Portuguese (Brazil) for the Record tabs example** — the translation travels inside the package. */
const RECORD_TAB_PT_BR: Record<string, string> = {
  'package.name': 'Abas no registro, pelo exemplo',
  'package.category': 'Interface',
  'package.description':
    'Uma aba própria dentro do registro de outra tela: a linha do tempo dos marcos de cada projeto, com visual próprio.',
  'package.summary':
    'Como uma extensão mostra algo DENTRO de um registro que não é dela. Acrescenta duas abas ao detalhe de um Projeto: a linha do tempo dos marcos daquele projeto, desenhada por uma view de código que recebe o registro aberto, e uma aba declarativa desenhada a partir de uma árvore do Widget DSL. A tela de Marcos NÃO é filha de Projeto — a aba não é a lista genérica de tela-filha, é o que a extensão desenhar. A de Atualizações é, e os registros dela congelam 15 minutos depois de criados (`editWindow`).',

  'screen.project': 'Projeto',
  'screen.project.plural': 'Projetos',
  'screen.milestone': 'Marco',
  'screen.milestone.plural': 'Marcos',
  'screen.update': 'Atualização',
  'screen.update.plural': 'Atualizações',

  'nav.milestones': 'Marcos',

  'field.name': 'Nome',
  'field.description': 'Descrição',
  'field.title': 'Título',
  'field.project': 'Projeto',
  'field.dueDate': 'Data prevista',
  'field.priority': 'Prioridade',
  'field.priority.high': 'Alta',
  'field.priority.medium': 'Média',
  'field.priority.low': 'Baixa',
  'field.done': 'Concluído',
  'field.relatedProjects': 'Também afeta',
  'field.update': 'Atualização',

  'tab.timeline': 'Linha do tempo',
  'tab.timeline.description': 'Os marcos deste projeto, e os que também o afetam, do mais recente para o mais antigo.',
  'tab.about': 'Sobre estas abas',
  'tab.about.description': 'Uma aba declarativa, que não recebe dado.',

  'timeline.new': 'Novo marco',
  'timeline.empty': 'Nenhum marco neste projeto ainda.',
  'timeline.complete': 'Marcar como concluído',
  'timeline.reopen': 'Reabrir',
  'timeline.no-date': 'Sem data prevista',
  'timeline.screen-missing': 'A tela de Marcos não está instalada neste escritório.',

  'about.heading': 'Posto por uma extensão',
  'about.body':
    'As duas abas são contribuições `ui.tab` em `recordSurface(\'microteia:record-tab-example:project\')`. O endereço é o `sourceId` da tela, nunca a chave instalada — é o que permite a uma extensão acrescentar uma aba à tela de OUTRA extensão.\n\nA linha do tempo é uma view de código: recebe `RecordTabProps` e lista os marcos com `useEntityList(sourceId, { parent: { fieldKeys: [\'project\', \'relatedProjects\'], recordId } })`, então a lista fica presa a este projeto — os marcos que são dele e os que o citam no campo `multi` \'Também afeta\' — e um marco novo já nasce ligado a ele.\n\nEsta aba é uma árvore do Widget DSL, e por isso não recebe dado.',
};

export const recordTabPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: RECORD_TAB_NAMESPACE,
    messages: RECORD_TAB_PT_BR,
  });
