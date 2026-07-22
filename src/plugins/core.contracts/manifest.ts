import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { ContractCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/ContractCommandProvider';

export const coreContractsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ContractsView: lazyView(() => import('../../presentation/pages/Contracts/Contracts.view'), 'ContractsView'),
    ViewContractView: lazyView(() => import('../../presentation/pages/ViewContract/ViewContract.view'), 'ViewContractView'),
    ContractCommandProvider,
  },
  manifest: {
    id: 'core.contracts',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Contratos',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'contracts', title: 'Contratos', icon: 'fileText' }, 'ContractsView'),
      page({ key: 'new-contract', title: 'Novo Contrato', icon: 'fileText' }, 'ViewContractView'),
      page({ key: '', keyPrefix: 'new-contract:clone:', title: 'Novo Contrato', icon: 'fileText' }, 'ViewContractView'),
      page({ key: '', keyPrefix: 'view-contract:', title: 'Contrato', icon: 'fileText' }, 'ViewContractView'),
      nav({ key: 'contracts', label: 'Contratos', icon: 'fileText', order: 50 }),
      command('contract', { group: 'Contratos' }, 'ContractCommandProvider'),
    ],
  },
};
