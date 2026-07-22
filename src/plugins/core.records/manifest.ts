import type { PluginRecord } from '../../kernel';
import { command, lazyView, page } from '../contributionBuilders';
import { DynamicRecordCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/DynamicRecordCommandProvider';

export const coreRecordsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ScreenBuilderView: lazyView(() => import('../../presentation/pages/ScreenBuilder/ScreenBuilder.view'), 'ScreenBuilderView'),
    DynamicRecordListView: lazyView(() => import('../../presentation/pages/DynamicRecordList/DynamicRecordList.view'), 'DynamicRecordListView'),
    ViewDynamicRecordView: lazyView(() => import('../../presentation/pages/ViewDynamicRecord/ViewDynamicRecord.view'), 'ViewDynamicRecordView'),
    DynamicRecordCommandProvider,
  },
  manifest: {
    id: 'core.records',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Telas Personalizadas',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'screen-builder', title: 'Form Design', icon: 'layoutGrid' }, 'ScreenBuilderView'),
      page({ key: '', keyPrefix: 'dyn:', title: 'Tela personalizada', icon: 'layoutGrid' }, 'DynamicRecordListView'),
      page({ key: '', keyPrefix: 'new-dyn:', title: 'Novo registro', icon: 'layoutGrid' }, 'ViewDynamicRecordView'),
      page({ key: '', keyPrefix: 'view-dyn:', title: 'Registro', icon: 'layoutGrid' }, 'ViewDynamicRecordView'),
      command('dynamic-record', { group: 'Registros' }, 'DynamicRecordCommandProvider'),
    ],
  },
};
