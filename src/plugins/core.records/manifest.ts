import type { PluginRecord } from '../../kernel';
import { command, lazyView, menuItem, page, recordAction } from '../contributionBuilders';
import { DynamicRecordCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/DynamicRecordCommandProvider';
import {
  RECORD_ACTION_METADATA,
  cloneCommand,
  copyLinkCommand,
  deleteCommand,
  manageTagsCommand,
  unlinkCommand,
} from './recordActionCommands';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_SCREENS_MANAGE } from '../../domain/schema/access';
import { USER_MENU_SURFACE } from '../../domain/schema/ui/uiExtensionPoints';
import { coreMessage, CORE_RECORDS_MESSAGES } from '../coreMessages';

export const coreRecordsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ScreenBuilderView: lazyView(() => import('../../presentation/pages/ScreenBuilder/ScreenBuilder.view'), 'ScreenBuilderView'),
    DynamicRecordListView: lazyView(() => import('../../presentation/pages/DynamicRecordList/DynamicRecordList.view'), 'DynamicRecordListView'),
    ViewDynamicRecordView: lazyView(() => import('../../presentation/pages/ViewDynamicRecord/ViewDynamicRecord.view'), 'ViewDynamicRecordView'),
    DynamicRecordCommandProvider,
    CopyLinkRecordAction: copyLinkCommand,
    CloneRecordAction: cloneCommand,
    ManageTagsRecordAction: manageTagsCommand,
    DeleteRecordAction: deleteCommand,
    UnlinkRecordAction: unlinkCommand,
  },
  manifest: {
    id: 'core.records',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Custom Screens',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.records', CORE_RECORDS_MESSAGES)),
      page({ key: 'screen-builder', title: '@core.records/page.screen-builder', icon: 'layoutGrid' }, 'ScreenBuilderView'),
      page({ key: '', keyPrefix: 'dyn:', title: '@core.records/page.dynamic-list', icon: 'layoutGrid' }, 'DynamicRecordListView'),
      page({ key: '', keyPrefix: 'new-dyn:', title: '@core.records/page.dynamic-new', icon: 'layoutGrid' }, 'ViewDynamicRecordView'),
      page({ key: '', keyPrefix: 'view-dyn:', title: '@core.records/page.dynamic-record', icon: 'layoutGrid' }, 'ViewDynamicRecordView'),
      command('dynamic-record', { group: '@core.records/command.group' }, 'DynamicRecordCommandProvider'),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'screen-builder',
        title: '@core.records/page.screen-builder',
        icon: 'layoutGrid',
        order: 30,
        requiredPermissions: [PERMISSION_SCREENS_MANAGE],
        action: { kind: 'openTab', tabKey: 'screen-builder' },
      }),
      // As ações que todo registro oferece. Contribuições como quaisquer outras: remover uma linha
      // daqui tira a ação de toda tela, sem que o kernel saiba que ela existia.
      recordAction(RECORD_ACTION_METADATA.copyLink, 'CopyLinkRecordAction'),
      recordAction(RECORD_ACTION_METADATA.clone, 'CloneRecordAction'),
      recordAction(RECORD_ACTION_METADATA.manageTags, 'ManageTagsRecordAction'),
      recordAction(RECORD_ACTION_METADATA.delete, 'DeleteRecordAction'),
      recordAction(RECORD_ACTION_METADATA.unlink, 'UnlinkRecordAction'),
    ],
  },
};
