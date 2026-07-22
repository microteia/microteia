import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { NewsCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/NewsCommandProvider';

export const coreNewsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    NewsView: lazyView(() => import('../../presentation/pages/News/News.view'), 'NewsView'),
    AddNewsView: lazyView(() => import('../../presentation/pages/AddNews/AddNews.view'), 'AddNewsView'),
    ViewNewsView: lazyView(() => import('../../presentation/pages/ViewNews/ViewNews.view'), 'ViewNewsView'),
    NewsCommandProvider,
  },
  manifest: {
    id: 'core.news',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Notícias',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'news', title: 'Notícias', icon: 'newspaper' }, 'NewsView'),
      page({ key: 'add-news', title: 'Nova Notícia', icon: 'newspaper' }, 'AddNewsView'),
      page({ key: '', keyPrefix: 'edit-news:', title: 'Editar Notícia', icon: 'newspaper' }, 'AddNewsView'),
      page({ key: '', keyPrefix: 'view-news:', title: 'Notícia', icon: 'newspaper' }, 'ViewNewsView'),
      nav({ key: 'news', label: 'Notícias', icon: 'newspaper', order: 90 }),
      command('news', { group: 'Notícias' }, 'NewsCommandProvider'),
    ],
  },
};
