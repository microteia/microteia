import { useCallback, useMemo, useState } from 'react';
import { useDocumentTemplates } from '../../../../stores/useDocumentTemplates';
import { useNotification } from '../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useAuthorization } from '../../../../stores/useAuthorization';
import type { RecordDialogProps } from '../../../../stores/useRecordDialog';
import type { DocumentOutputFormat } from '../../../../domain/schema/document/documentTemplate';
import { templateOutputs, templatesForCollection } from '../../../../domain/schema/document/documentTemplate';
import type { DocumentDestination } from '../../../../domain/schema/document/documentDownloads';
import { collectionPermissionId } from '../../../../domain/schema/access/permission';
import { useResolvedDocumentTemplates } from '../../../shared/documents/useResolvedDocumentTemplates';
import { useLabel, useT } from '../../../shared/i18n/useT';
import type { SearchSelectOption } from '../SearchSelect';

export interface GenerateDocumentDialogViewModel {
  /** Anexar ao registro não está ao alcance (sem aba Documentos, ou sem permissão de editar): só Downloads. */
  downloadsOnly: boolean;
  templateOptions: SearchSelectOption[];
  templateKey: string;
  setTemplateKey: (key: string) => void;
  outputOptions: SearchSelectOption[];
  output: string;
  setOutput: (output: string) => void;
  destinationOptions: SearchSelectOption[];
  destination: string;
  setDestination: (destination: string) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  handleGenerate: () => Promise<void>;
  onClose: () => void;
}

const OUTPUT_LABELS: Record<DocumentOutputFormat, string> = {
  pdf: 'output.pdf',
  docx: 'output.docx',
};

const DESTINATION_LABELS: Record<DocumentDestination, string> = {
  record: 'destination.record',
  downloads: 'destination.downloads',
};

export const useGenerateDocumentDialogViewModel = (props: RecordDialogProps): GenerateDocumentDialogViewModel => {
  const { record, collection, screenKey, onClose } = props;
  const t = useT('core.documents');
  const label = useLabel();
  const { notify } = useNotification();
  const { getDefinition } = useScreenDefinitions();
  const { generateDocument } = useDocumentTemplates();
  const { can } = useAuthorization();
  const resolved = useResolvedDocumentTemplates();

  const templates = useMemo(() => templatesForCollection(resolved, collection), [resolved, collection]);

  const [chosenKey, setChosenKey] = useState('');
  const [chosenOutput, setChosenOutput] = useState('');
  const [chosenDestination, setChosenDestination] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const template = templates.find((one) => one.key === chosenKey) ?? templates[0] ?? null;
  const outputs = useMemo(() => (template ? templateOutputs(template) : []), [template]);
  const output = outputs.includes(chosenOutput as DocumentOutputFormat) ? chosenOutput : outputs[0] ?? '';

  const templateOptions = useMemo(
    () => templates.map((one) => ({ value: one.key, label: label(one.title), meta: one.key })),
    [templates, label],
  );

  const outputOptions = useMemo(
    () => outputs.map((one) => ({ value: one, label: t(OUTPUT_LABELS[one]) })),
    [outputs, t],
  );

  const setTemplateKey = useCallback((key: string) => {
    setChosenKey(key);
    setChosenOutput('');
    setChosenDestination('');
  }, []);

  const hasDocuments = getDefinition(screenKey)?.hasDocuments === true;
  // O motor não troca o destino sozinho; quem oferece Downloads no lugar da aba é esta tela, à vista.
  const canAttach = hasDocuments && can(collectionPermissionId(collection, 'update'));
  const destinations = useMemo<DocumentDestination[]>(
    () => (canAttach ? ['record', 'downloads'] : ['downloads']),
    [canAttach],
  );
  const preferred = template?.destination && destinations.includes(template.destination)
    ? template.destination
    : destinations[0];
  const destination = destinations.includes(chosenDestination as DocumentDestination)
    ? (chosenDestination as DocumentDestination)
    : preferred;

  const destinationOptions = useMemo(
    () => destinations.map((one) => ({ value: one, label: t(DESTINATION_LABELS[one]) })),
    [destinations, t],
  );

  const handleGenerate = useCallback(async () => {
    if (!template || !output) return;
    setIsGenerating(true);
    try {
      const result = await generateDocument({
        templateKey: template.key,
        collection: template.collection,
        recordId: record.id,
        output: output as DocumentOutputFormat,
        destination,
      });
      if (!result.document) {
        notify(label(result.error ?? '@core.documents/generate.failed', result.errorParams), 'error');
        return;
      }
      const params = { name: result.document.name, count: String(result.emptyFields) };
      const gaps = result.emptyFields > 0;
      notify(
        result.destination === 'downloads'
          ? t(gaps ? 'generate.done-downloads-with-gaps' : 'generate.done-downloads', params)
          : t(gaps ? 'generate.done-with-gaps' : 'generate.done', params),
        'success',
      );
      onClose();
    } catch {
      notify(t('generate.failed'), 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, output, destination, generateDocument, record.id, notify, label, t, onClose]);

  return {
    downloadsOnly: !canAttach,
    templateOptions,
    templateKey: template?.key ?? '',
    setTemplateKey,
    outputOptions,
    output,
    setOutput: setChosenOutput,
    destinationOptions,
    destination,
    setDestination: setChosenDestination,
    isGenerating,
    canGenerate: !!template && !!output && !isGenerating,
    handleGenerate,
    onClose,
  };
};
