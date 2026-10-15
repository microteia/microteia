import { useCallback, useMemo, useState } from 'react';
import { useDocumentTemplates } from '../../../../stores/useDocumentTemplates';
import { useNotification } from '../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import type { RecordDialogProps } from '../../../../stores/useRecordDialog';
import type { DocumentOutputFormat } from '../../../../domain/schema/document/documentTemplate';
import { templateOutputs, templatesForCollection } from '../../../../domain/schema/document/documentTemplate';
import { useResolvedDocumentTemplates } from '../../../shared/documents/useResolvedDocumentTemplates';
import { useLabel, useT } from '../../../shared/i18n/useT';
import type { SearchSelectOption } from '../SearchSelect';

export interface GenerateDocumentDialogViewModel {
  hasDocuments: boolean;
  templateOptions: SearchSelectOption[];
  templateKey: string;
  setTemplateKey: (key: string) => void;
  outputOptions: SearchSelectOption[];
  output: string;
  setOutput: (output: string) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  handleGenerate: () => Promise<void>;
  onClose: () => void;
}

const OUTPUT_LABELS: Record<DocumentOutputFormat, string> = {
  pdf: 'output.pdf',
  docx: 'output.docx',
};

export const useGenerateDocumentDialogViewModel = (props: RecordDialogProps): GenerateDocumentDialogViewModel => {
  const { record, collection, screenKey, onClose } = props;
  const t = useT('core.documents');
  const label = useLabel();
  const { notify } = useNotification();
  const { getDefinition } = useScreenDefinitions();
  const { generateDocument } = useDocumentTemplates();
  const resolved = useResolvedDocumentTemplates();

  const templates = useMemo(() => templatesForCollection(resolved, collection), [resolved, collection]);

  const [chosenKey, setChosenKey] = useState('');
  const [chosenOutput, setChosenOutput] = useState('');
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
  }, []);

  const hasDocuments = getDefinition(screenKey)?.hasDocuments === true;

  const handleGenerate = useCallback(async () => {
    if (!template || !output) return;
    setIsGenerating(true);
    try {
      const result = await generateDocument({
        templateKey: template.key,
        collection: template.collection,
        recordId: record.id,
        output: output as DocumentOutputFormat,
      });
      if (!result.document) {
        notify(label(result.error ?? '@core.documents/generate.failed', result.errorParams), 'error');
        return;
      }
      notify(
        result.emptyFields > 0
          ? t('generate.done-with-gaps', { name: result.document.name, count: String(result.emptyFields) })
          : t('generate.done', { name: result.document.name }),
        'success',
      );
      onClose();
    } catch {
      notify(t('generate.failed'), 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, output, generateDocument, record.id, notify, label, t, onClose]);

  return {
    hasDocuments,
    templateOptions,
    templateKey: template?.key ?? '',
    setTemplateKey,
    outputOptions,
    output,
    setOutput: setChosenOutput,
    isGenerating,
    canGenerate: hasDocuments && !!template && !!output && !isGenerating,
    handleGenerate,
    onClose,
  };
};
