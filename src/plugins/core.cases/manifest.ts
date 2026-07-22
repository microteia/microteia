import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { CaseCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/CaseCommandProvider';

export const coreCasesPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    CasesView: lazyView(() => import('../../presentation/pages/Cases/Cases.view'), 'CasesView'),
    ViewCaseView: lazyView(() => import('../../presentation/pages/ViewCase/ViewCase.view'), 'ViewCaseView'),
    CaseCommandProvider,
  },
  manifest: {
    id: 'core.cases',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Processos',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'cases', title: 'Processos', icon: 'folder' }, 'CasesView'),
      page({ key: 'new-case', title: 'Novo Processo', icon: 'folder' }, 'ViewCaseView'),
      page({ key: '', keyPrefix: 'new-case:clone:', title: 'Novo Processo', icon: 'folder' }, 'ViewCaseView'),
      page({ key: '', keyPrefix: 'view-case:', title: 'Processo', icon: 'folder' }, 'ViewCaseView'),
      nav({ key: 'cases', label: 'Processos', icon: 'folder', order: 40 }),
      command('case', { group: 'Processos' }, 'CaseCommandProvider'),
    ],
  },
};
