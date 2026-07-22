import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { PersonCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/PersonCommandProvider';

export const corePersonsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    PersonsView: lazyView(() => import('../../presentation/pages/Persons/Persons.view'), 'PersonsView'),
    ViewPersonView: lazyView(() => import('../../presentation/pages/Persons/ViewPerson.view'), 'ViewPersonView'),
    PersonCommandProvider,
  },
  manifest: {
    id: 'core.persons',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Pessoas',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'persons', title: 'Pessoas', icon: 'team' }, 'PersonsView'),
      page({ key: 'new-person', title: 'Nova Pessoa', icon: 'team' }, 'ViewPersonView'),
      page({ key: '', keyPrefix: 'new-person:clone:', title: 'Nova Pessoa', icon: 'team' }, 'ViewPersonView'),
      page({ key: '', keyPrefix: 'view-person:', title: 'Pessoa', icon: 'team' }, 'ViewPersonView'),
      nav({ key: 'persons', label: 'Pessoas', icon: 'team', order: 30 }),
      command('person', { group: 'Pessoas' }, 'PersonCommandProvider'),
    ],
  },
};
