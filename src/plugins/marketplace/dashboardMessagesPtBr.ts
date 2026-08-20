import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { DASHBOARD_NAMESPACE } from './dashboardMessages';

/**
 * **Portuguese (Brazil) for the Dashboard** — the translation the extension carries itself.
 *
 * Same mechanism as the kernel language package, different owner: what this extension declares, this
 * extension translates.
 */
const DASHBOARD_PT_BR: Record<string, string> = {
  'package.name': 'Painel',
  'package.description': 'A tela de abertura do escritório, montada com os widgets que cada extensão oferece.',
  'package.summary':
    'A tela de abertura do escritório: uma grade de widgets que cada extensão instalada oferece. Você escolhe quais aparecem, em que ordem e com que largura — e cada pessoa pode montar o seu do jeito que preferir.',

  'nav.dashboard': 'Painel',
  'page.dashboard': 'Painel',

  'settings.section.title': 'Painel',
  'settings.section.description': 'O que aparece na tela de abertura, em que ordem e com que largura.',
  'settings.widgets': 'Widgets do Painel',
  'settings.widgets.description':
    'Marque os cartões que devem aparecer, escolha a largura de cada um (1 a 3 colunas) e use as setas para ordenar. O que a extensão instalar depois entra no fim da lista.',

  'overview.body':
    'O **Painel** é a tela que abre quando você entra no escritório. Ele não tem conteúdo próprio: mostra os **widgets** que as outras extensões oferecem — os números, as datas que vencem, os resumos.\n\nEm **Configurações → Painel** você liga e desliga cada widget, define a largura (1, 2 ou 3 colunas) e a ordem. O administrador define o Painel padrão do escritório em **Escritório**; cada pessoa pode montar o seu em **Usuário**.',
  'overview.adds': 'Adiciona',
  'overview.adds.value': 'Item "Painel" no menu',
  'overview.content': 'Conteúdo',
  'overview.content.value': 'Widgets das extensões instaladas',
  'overview.configuration': 'Configuração',
  'overview.configuration.value': 'Por escritório e por usuário',
  'overview.banner':
    'Instalar uma extensão que ofereça widgets faz os cartões dela aparecerem aqui automaticamente; remover a extensão os retira, sem deixar espaço vazio.',

  'view.empty': 'Nenhum widget disponível. Instale extensões para o Painel ganhar conteúdo.',
};

export const dashboardPtBrContribution = (): Contribution => messageBundleContribution({
  locale: 'pt-BR',
  namespace: DASHBOARD_NAMESPACE,
  messages: DASHBOARD_PT_BR,
});
