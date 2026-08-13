import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { nav, page, settingsSection } from '../contributionBuilders';

/**
 * **Dashboard** — a tela de abertura do escritório, agora uma extensão que não conhece nenhum dado.
 *
 * O que ela entrega é só o LUGAR: uma superfície chamada `dashboard`, onde cada extensão instalada
 * coloca os seus cartões, e a seção de Configurações que decide quais aparecem, em que ordem e com
 * que largura. Os números de processos, os prazos e o resumo financeiro NÃO estão aqui — são
 * widgets das extensões que conhecem cada um desses assuntos. Desinstalar o Financeiro tira o
 * cartão do Dashboard sem tocar em uma linha desta extensão.
 *
 * A configuração aceita os dois escopos: o administrador define o Dashboard padrão do escritório e
 * cada pessoa monta o seu por cima, sem alterar o dos demais.
 */
export const DASHBOARD_SURFACE = 'dashboard';

const DASHBOARD_SOURCE = `
import { WidgetSurface } from '@microteia/ui';
import { styled } from 'styled-components';

const Page = styled.div\`
  padding: \${({ theme }) => theme.spacing.xl};
  height: 100%;
  overflow-y: auto;
\`;

export default function DashboardView() {
  return (
    <Page>
      <WidgetSurface
        surface="dashboard"
        emptyMessage="Nenhum widget disponível. Instale extensões (Processos, Prazos, Financeiro…) para o Dashboard ganhar conteúdo."
      />
    </Page>
  );
}
`;

export const dashboardPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.dashboard',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Dashboard',
    description: 'A tela de abertura do escritório, montada com os widgets que cada extensão oferece.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({ key: 'dashboard', label: 'Dashboard', icon: 'dashboard', order: 10 }),
      page({ key: 'dashboard', title: 'Dashboard', icon: 'dashboard', fullBleed: true }, 'dashboard'),
      settingsSection({
        key: 'dashboard',
        title: 'Dashboard',
        icon: 'dashboard',
        order: 10,
        description: 'O que aparece na tela de abertura, em que ordem e com que largura.',
        properties: [
          {
            key: 'dashboard.widgets',
            label: 'Widgets do Dashboard',
            description:
              'Marque os cartões que devem aparecer, escolha a largura de cada um (1 a 3 colunas) e use as setas para ordenar. O que a extensão instalar depois entra no fim da lista.',
            type: 'widgets',
            surface: DASHBOARD_SURFACE,
            default: [],
            scopes: ['tenant', 'user'],
          },
        ],
      }),
    ],
  },
  summary:
    'A tela de abertura do escritório: uma grade de widgets que cada extensão instalada oferece. Você escolhe quais aparecem, em que ordem e com que largura — e cada pessoa pode montar o seu do jeito que preferir.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'O **Dashboard** é a tela que abre quando você entra no escritório. Ele não tem conteúdo próprio: mostra os **widgets** que as outras extensões oferecem — os números dos processos, os prazos que vencem, o resumo do financeiro.\n\nEm **Configurações → Dashboard** você liga e desliga cada widget, define a largura (1, 2 ou 3 colunas) e a ordem. O administrador define o Dashboard padrão do escritório em **Escritório**; cada pessoa pode montar o seu em **Usuário**.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Dashboard" no menu' },
          { label: 'Conteúdo', value: 'Widgets das extensões instaladas' },
          { label: 'Configuração', value: 'Por escritório e por usuário' },
        ],
      },
      {
        type: 'banner',
        message: 'Instalar uma extensão que ofereça widgets faz os cartões dela aparecerem aqui automaticamente; remover a extensão os retira, sem deixar espaço vazio.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  views: [
    {
      key: 'dashboard',
      title: 'Dashboard',
      icon: 'dashboard',
      source: DASHBOARD_SOURCE,
    },
  ],
};
