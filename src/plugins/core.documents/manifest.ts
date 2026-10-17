import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page, recordAction, settingsSection } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../domain/schema/access';
import { CUSTOMIZATION_NAV_GROUP } from '../../domain/schema/ui/uiExtensionPoints';
import { RECORD_ACTION_METADATA } from '../../domain/schema/ui/recordActionMetadata';
import { DOCUMENT_EXTENSION_POINTS } from '../../domain/schema/document/documentTemplate';
import {
  DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY,
  DEFAULT_DOWNLOAD_RETENTION_DAYS,
  DOWNLOAD_AUTOMATION_VISIBILITY_SETTING,
  DOWNLOAD_RETENTION_MAX_DAYS,
  DOWNLOAD_RETENTION_SETTING,
} from '../../domain/schema/document/documentDownloads';
import { coreMessage, CORE_DOCUMENTS_MESSAGES } from '../coreMessages';
import { generateDocumentCommand } from './generateDocumentCommand';

/**
 * **Os documentos** — procuração, contrato, recibo, notificação gerados a partir de um registro.
 *
 * Ele não declara modelo nenhum, e é essa ausência que o justifica: o modelo é sobre um assunto, e o
 * assunto é do escritório ou da extensão que o traz. O que o núcleo declara é o PONTO pelo qual um
 * modelo chega (`document.template`), o lugar onde o escritório escreve o próprio, o gesto que gera
 * — o mesmo caso de uso do passo `render-document` — e a tela Downloads, para onde vai o arquivo que
 * não é anexado a um registro.
 */
export const coreDocumentsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    DocumentTemplatesView: lazyView(
      () => import('../../presentation/pages/DocumentTemplates/DocumentTemplates.view'),
      'DocumentTemplatesView',
    ),
    DownloadsView: lazyView(() => import('../../presentation/pages/Downloads/Downloads.view'), 'DownloadsView'),
    GenerateDocumentRecordAction: generateDocumentCommand,
  },
  manifest: {
    id: 'core.documents',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Documents',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the extension point through which a document template reaches the organization, and the gesture that generates a document from a record.',
    extensionPoints: DOCUMENT_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.documents', CORE_DOCUMENTS_MESSAGES)),
      page(
        {
          key: 'document-templates',
          title: '@core.documents/page.templates',
          icon: 'fileText',
          requiredPermissions: [PERMISSION_DOCUMENT_TEMPLATES_MANAGE],
        },
        'DocumentTemplatesView',
      ),
      nav({ key: 'document-templates', label: '@core.documents/page.templates', icon: 'fileText', order: 103, group: CUSTOMIZATION_NAV_GROUP, requiredPermissions: [PERMISSION_DOCUMENT_TEMPLATES_MANAGE] }),
      recordAction(RECORD_ACTION_METADATA.generateDocument, 'GenerateDocumentRecordAction'),
      page({ key: 'downloads', title: '@core.documents/page.downloads', icon: 'fileDownload' }, 'DownloadsView'),
      nav({ key: 'downloads', label: '@core.documents/page.downloads', icon: 'fileDownload', order: 96 }),
      settingsSection({
        key: 'downloads',
        title: '@core.documents/settings.downloads.title',
        description: '@core.documents/settings.downloads.description',
        icon: 'fileDownload',
        order: 40,
        properties: [
          {
            key: DOWNLOAD_RETENTION_SETTING,
            label: '@core.documents/settings.downloads.retention.label',
            description: '@core.documents/settings.downloads.retention.description',
            type: 'number',
            default: DEFAULT_DOWNLOAD_RETENTION_DAYS,
            min: 0,
            max: DOWNLOAD_RETENTION_MAX_DAYS,
            scopes: ['tenant'],
          },
          {
            key: DOWNLOAD_AUTOMATION_VISIBILITY_SETTING,
            label: '@core.documents/settings.downloads.visibility.label',
            description: '@core.documents/settings.downloads.visibility.description',
            type: 'select',
            default: DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY,
            options: [
              { value: 'managers', label: '@core.documents/settings.downloads.visibility.managers' },
              { value: 'everyone', label: '@core.documents/settings.downloads.visibility.everyone' },
            ],
            scopes: ['tenant'],
          },
        ],
      }),
    ],
    dependencies: { 'core.ui': '^1.0.0' },
  },
};
