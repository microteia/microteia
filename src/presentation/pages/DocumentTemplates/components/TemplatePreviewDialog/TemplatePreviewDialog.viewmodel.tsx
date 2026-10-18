import { useEffect, useMemo, useState } from 'react';
import { useDocumentTemplates } from '../../../../../stores/useDocumentTemplates';
import { useScreenDefinitions } from '../../../../../stores/useScreenDefinitions';
import type { DocumentTemplateSpec } from '../../../../../domain/schema/document/documentTemplate';
import { isPayloadTemplate } from '../../../../../domain/schema/document/documentTemplate';
import { screenDataCollection } from '../../../../../domain/services/screenDataCollection';
import { useReferenceOptions } from '../../../../hooks/useReferenceOptions';
import { useLabel } from '../../../../shared/i18n/useT';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface TemplatePreviewDialogProps {
  /** O modelo como está no editor — o rascunho, gravado ou não. */
  template: DocumentTemplateSpec;
  onClose: () => void;
}

export interface TemplatePreviewDialogViewModel {
  isPayload: boolean;
  /** O modelo de dados não tem exemplo: não há o que mesclar. */
  missingSample: boolean;
  recordOptions: SearchSelectOption[];
  recordId: string;
  setRecordId: (recordId: string) => void;
  isLoading: boolean;
  /** O texto mesclado, ou `null` antes da resposta e quando ela é uma recusa. */
  text: string | null;
  /** O texto é de um Word: sai como texto corrido, sem o leiaute do documento. */
  isWord: boolean;
  fileName: string;
  error: string | null;
  emptyFields: string[];
}

interface PreviewState {
  /** O pedido a que esta resposta corresponde — uma resposta velha não pinta o pedido novo. */
  key: string;
  text: string | null;
  fileName: string;
  error: string | null;
  emptyFields: string[];
}

/**
 * A pré-visualização do editor de modelos: o RASCUNHO mesclado no servidor, pelo mesmo caso de uso que
 * gera — contra um registro escolhido aqui (modelo de tela) ou contra o exemplo do modelo (de dados).
 * Cada escolha de registro dispara uma nova mesclagem; nada é gravado.
 */
export const useTemplatePreviewDialogViewModel = (props: TemplatePreviewDialogProps): TemplatePreviewDialogViewModel => {
  const { template } = props;
  const { previewDocument } = useDocumentTemplates();
  const { getDefinition } = useScreenDefinitions();
  const referenceOptions = useReferenceOptions();
  const label = useLabel();

  const isPayload = isPayloadTemplate(template);
  const definition = isPayload ? undefined : getDefinition(template.collection);
  const collection = definition ? screenDataCollection(definition) : template.collection;

  const recordOptions = useMemo(
    () => (isPayload ? [] : referenceOptions[collection] ?? []),
    [isPayload, referenceOptions, collection],
  );

  const [chosenRecordId, setRecordId] = useState<string | null>(null);
  const recordId = chosenRecordId ?? recordOptions[0]?.value ?? '';
  const missingSample = isPayload && !template.sample;

  const requestKey = isPayload ? 'sample' : recordId;
  const canAsk = isPayload ? !missingSample : recordId !== '';

  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!canAsk) return undefined;
    let current = true;
    previewDocument({ template, ...(isPayload ? {} : { recordId }) })
      .then((result) => {
        if (!current) return;
        setState({
          key: requestKey,
          text: result.preview?.text ?? null,
          fileName: result.preview ? `${result.preview.fileName}.${result.preview.output}` : '',
          error: result.error ? label(result.error, result.errorParams) : null,
          emptyFields: result.empty.map((one) =>
            label('@core.documents/render.field-empty', { expression: one.expression, detail: label(one.detail) })),
        });
      })
      .catch(() => {
        if (!current) return;
        setState({ key: requestKey, text: null, fileName: '', error: label('@core.documents/preview.failed'), emptyFields: [] });
      });
    return () => { current = false; };
  }, [canAsk, previewDocument, template, isPayload, recordId, requestKey, label]);

  const shown = state && state.key === requestKey ? state : null;

  return {
    isPayload,
    missingSample,
    recordOptions,
    recordId,
    setRecordId,
    isLoading: canAsk && shown === null,
    text: shown?.text ?? null,
    isWord: template.format === 'docx',
    fileName: shown?.fileName ?? '',
    error: shown?.error ?? null,
    emptyFields: shown?.emptyFields ?? [],
  };
};
