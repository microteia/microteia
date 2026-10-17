import { useCallback, useMemo, useState } from 'react';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import type { DocumentTemplateSpec } from '../../../domain/schema/document/documentTemplate';
import { cloneParameterInList, siblingParameterErrors } from '../../../domain/schema/workflowParameters';
import { samplePayloadFrom } from '../../../domain/schema/document/payloadStarter';
import { useEntityReferenceOptions, useLookupCollectionOptions } from '../useParameterOptions';
import { PARAMETER_TYPE_KEYS } from '../parameterTypeKeys';
import { useLabel, useT } from '../i18n/useT';

export interface TemplatePayloadEditor {
  parameters: WorkflowParameter[];
  parameterErrors: (string | undefined)[];
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  lookupOptions: { value: string; label: string }[];
  addParameter: () => void;
  updateParameter: (index: number, patch: Partial<WorkflowParameter>) => void;
  removeParameter: (index: number) => void;
  cloneParameter: (index: number) => void;
  replaceParameters: (parameters: WorkflowParameter[]) => void;
  /** O exemplo como texto JSON — o que está no campo, válido ou não. */
  sampleText: string;
  setSampleText: (text: string) => void;
  /** O texto do exemplo não é um objeto JSON: o modelo continua com o último exemplo válido. */
  sampleInvalid: boolean;
  /** Preenche o exemplo com o esqueleto que os parâmetros pedem. */
  fillSample: () => void;
}

interface SampleDraft {
  /** A chave do modelo a que o rascunho pertence — trocar de modelo descarta o rascunho. */
  owner: string;
  text: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sampleTextOf = (sample: Record<string, unknown> | undefined): string =>
  sample ? JSON.stringify(sample, null, 2) : '';

/**
 * O contrato de um modelo de DADOS na tela de modelos: os parâmetros, no MESMO editor das automações e
 * dos scripts (visual e JSON, com grupos e listas), e o exemplo que a pré-visualização mescla.
 *
 * O exemplo é editado como texto: enquanto o JSON não fecha, o rascunho fica no campo e o modelo
 * continua com o último exemplo válido — apagar uma vírgula não pode apagar o exemplo.
 */
export const useTemplatePayloadEditor = (
  form: DocumentTemplateSpec,
  setForm: (patch: Partial<DocumentTemplateSpec>) => void,
): TemplatePayloadEditor => {
  const t = useT('core.automation');
  const label = useLabel();
  const entityOptions = useEntityReferenceOptions();
  const lookupOptions = useLookupCollectionOptions();
  const [draft, setDraft] = useState<SampleDraft | null>(null);

  const parameters = useMemo(() => form.parameters ?? [], [form.parameters]);

  const parameterErrors = useMemo(
    () => siblingParameterErrors(parameters).map((issue) => (issue ? label(issue.message, issue.messageParams) : undefined)),
    [parameters, label],
  );

  const typeOptions = useMemo(
    () => (Object.keys(PARAMETER_TYPE_KEYS) as WorkflowParameter['type'][])
      .map((type) => ({ value: type, label: t(PARAMETER_TYPE_KEYS[type]) })),
    [t],
  );

  const setParameters = useCallback((next: WorkflowParameter[]) => setForm({ parameters: next }), [setForm]);

  const addParameter = useCallback(
    () => setParameters([...parameters, { key: '', label: '', type: 'String' }]),
    [parameters, setParameters],
  );
  const updateParameter = useCallback(
    (index: number, patch: Partial<WorkflowParameter>) =>
      setParameters(parameters.map((parameter, at) => (at === index ? { ...parameter, ...patch } : parameter))),
    [parameters, setParameters],
  );
  const removeParameter = useCallback(
    (index: number) => setParameters(parameters.filter((_parameter, at) => at !== index)),
    [parameters, setParameters],
  );
  const cloneParameter = useCallback(
    (index: number) => setParameters(cloneParameterInList(parameters, index)),
    [parameters, setParameters],
  );

  const current = draft && draft.owner === form.key ? draft : null;
  const sampleText = current ? current.text : sampleTextOf(form.sample);

  const sampleInvalid = useMemo(() => {
    if (!current || current.text.trim() === '') return false;
    try {
      return !isPlainObject(JSON.parse(current.text));
    } catch {
      return true;
    }
  }, [current]);

  const setSampleText = useCallback(
    (text: string) => {
      setDraft({ owner: form.key, text });
      if (text.trim() === '') {
        setForm({ sample: undefined });
        return;
      }
      try {
        const parsed: unknown = JSON.parse(text);
        if (isPlainObject(parsed)) setForm({ sample: parsed });
      } catch {
        // O rascunho fica no campo; o modelo segue com o último exemplo válido.
      }
    },
    [form.key, setForm],
  );

  const fillSample = useCallback(() => {
    const sample = samplePayloadFrom(parameters);
    setDraft({ owner: form.key, text: sampleTextOf(sample) });
    setForm({ sample });
  }, [parameters, form.key, setForm]);

  return {
    parameters,
    parameterErrors,
    typeOptions,
    entityOptions,
    lookupOptions,
    addParameter,
    updateParameter,
    removeParameter,
    cloneParameter,
    replaceParameters: setParameters,
    sampleText,
    setSampleText,
    sampleInvalid,
    fillSample,
  };
};
