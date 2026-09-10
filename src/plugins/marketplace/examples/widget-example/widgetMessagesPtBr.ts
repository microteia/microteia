import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { WIDGET_NAMESPACE } from './widgetMessages';

/** **Portuguese (Brazil) for the Surfaces example** — the translation travels inside the package. */
const WIDGET_PT_BR: Record<string, string> = {
  'package.name': 'Superfícies, pelo exemplo',
  'package.category': 'Interface',
  'package.description':
    'Cartões no painel, uma marca no shell e uma aba nas configurações do escritório — tudo declarado como dado, sem código no navegador.',
  'package.summary':
    'Como uma extensão aparece em lugares que não são dela. Instala dois cartões na superfície do painel, duas marcas no shell da área de trabalho e uma aba nas configurações do escritório, e cada um deles é uma árvore do Widget DSL: dado que o kernel renderiza com os componentes dele. Nada aqui executa no navegador, então nada aqui exige que o escritório revise código antes de rodar.',

  'widget.glance': 'Num relance',
  'widget.glance.description': 'Um cartão no painel, desenhado a partir de uma árvore declarada.',
  'widget.how': 'Como este cartão chegou aqui',
  'widget.how.description': 'O que uma árvore do Widget DSL consegue dizer, e onde ela para.',

  'slot.badge': 'Marca na barra superior',
  'slot.badge.description': 'Uma marca posta à direita da barra superior.',
  'slot.status': 'Marca na barra de status',
  'slot.status.description': 'Uma marca posta à esquerda da barra de status.',

  'tab.about': 'Exemplo de superfícies',
  'tab.about.description': 'Uma aba acrescentada às configurações do escritório.',

  'glance.heading': 'Posto por uma extensão',
  'glance.installed': 'Instalada',
  'glance.installed.value': 'Exemplo de superfícies',
  'glance.code': 'Código no navegador',
  'glance.code.value': 'Nenhum',
  'glance.surface': 'Superfície',
  'glance.surface.value': 'dashboard',
  'glance.note':
    'Remova esta extensão e o cartão sai junto. Nada aqui foi acrescentado ao painel à mão.',

  'how.body':
    'Este cartão é uma **árvore de nós**, não um componente. O kernel a percorre e renderiza cada nó com os componentes dele — então a cor vem do tema, nunca da extensão.\n\nUm nó que o kernel não conhece é **ignorado, não fatal**: um cartão escrito para uma plataforma mais nova degrada em vez de derrubar o painel junto.\n\nPara pôr um NÚMERO de verdade num cartão, nomeie um relatório:\n\n```\n{ type: \'report\', report: \'chave-do-relatorio\' }\n```\n\nEssa é a ligação a dados — indireta de propósito, para que o significado de um número continue declarado num lugar só.',

  'badge.text': 'Exemplo de superfícies',
  'status.text': 'Posto por uma extensão',

  'about.heading': 'Superfícies, pelo exemplo',
  'about.body':
    'Uma **superfície** é um NOME, não uma tela. Quem hospeda uma declara o nome; quem a preenche nomeia a mesma string. Nenhum dos dois sabe que o outro existe.\n\nÉ por isso que esta aba não exigiu mudança em lugar nenhum: as configurações do escritório renderizam o que estiver registrado sob `tenant-settings`, e esta extensão registrou algo ali.\n\nO mesmo vale para os cartões do painel. Se a extensão Painel não estiver instalada, os cartões simplesmente não têm onde aparecer — e nada quebra.',
  'about.surfaces': 'Superfícies usadas',
  'about.surfaces.value': 'dashboard, top-bar.right, status-bar.left, tenant-settings',
};

export const widgetPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: WIDGET_NAMESPACE,
    messages: WIDGET_PT_BR,
  });
