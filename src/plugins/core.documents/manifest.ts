import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page, recordAction } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../domain/schema/access';
import { CUSTOMIZATION_NAV_GROUP } from '../../domain/schema/ui/uiExtensionPoints';
import { RECORD_ACTION_METADATA } from '../../domain/schema/ui/recordActionMetadata';
import { DOCUMENT_EXTENSION_POINTS } from '../../domain/schema/document/documentTemplate';
import { coreMessage, CORE_DOCUMENTS_MESSAGES } from '../coreMessages';
import { generateDocumentCommand } from './generateDocumentCommand';

/**
 * **Os documentos** — procuração, contrato, recibo, notificação gerados a partir de um registro.
 *
 * Ele não declara modelo nenhum, e é essa ausência que o justifica: o modelo é sobre um assunto, e o
 * assunto é do escritório ou da extensão que o traz. O que o núcleo declara é o PONTO pelo qual um
 * modelo chega (`document.template`), o lugar onde o escritório escreve o próprio, e o gesto que gera
 * — o mesmo caso de uso do passo `render-document`.
 */
export const coreDocumentsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    DocumentTemplatesView: lazyView(
      () => import('../../presentation/pages/DocumentTemplates/DocumentTemplates.view'),
      'DocumentTemplatesView',
    ),
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
    ],
    dependencies: { 'core.ui': '^1.0.0' },
  },
};
