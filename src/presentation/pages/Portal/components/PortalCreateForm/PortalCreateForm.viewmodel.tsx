import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '../../../../../stores/usePortal';
import type { PortalFieldInfo, PortalLinkOption, PortalScreenInfo } from '../../../../../domain/entities/Portal';

export interface PortalCreateFormProps {
  screen: PortalScreenInfo;
  onCancel: () => void;
  onSubmitted: () => void;
}

export interface PortalCreateFormViewModel {
  fields: PortalFieldInfo[];
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  linkLabel: string;
  linkOptions: Array<{ value: string; label: string }>;
  /** Uma opção só não pede escolha: ela é a resposta. */
  showLinkSelect: boolean;
  linkRecordId: string;
  setLinkRecordId: (value: string) => void;
  linkLoading: boolean;
  noLinkOptions: boolean;
  missingRequired: boolean;
  submitting: boolean;
  /** Texto pronto — a recusa de validação chega já traduzida pelo servidor. */
  error: string | null;
  submit: () => Promise<void>;
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

export const usePortalCreateFormViewModel = ({ screen, onSubmitted }: PortalCreateFormProps): PortalCreateFormViewModel => {
  const { listLinkOptions, submit: submitRecord } = usePortal();
  const create = screen.create;

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [options, setOptions] = useState<PortalLinkOption[]>([]);
  const [linkLoading, setLinkLoading] = useState(true);
  const [chosenLink, setChosenLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkCollection = create?.link.collection ?? '';

  useEffect(() => {
    if (!linkCollection) return;
    let active = true;
    listLinkOptions(linkCollection)
      .then((loaded) => { if (active) setOptions(loaded); })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setLinkLoading(false); });
    return () => { active = false; };
  }, [linkCollection, listLinkOptions]);

  const linkRecordId = chosenLink || (options.length === 1 ? options[0].recordId : '');
  const fields = useMemo(() => create?.fields ?? [], [create]);
  const missingRequired = fields.some((field) => field.required && isEmpty(values[field.key]));

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!linkRecordId || missingRequired) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = Object.fromEntries(Object.entries(values).filter(([, value]) => !isEmpty(value)));
      await submitRecord(screen.collection, linkRecordId, data);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    } finally {
      setSubmitting(false);
    }
  }, [linkRecordId, missingRequired, values, submitRecord, screen.collection, onSubmitted]);

  return {
    fields,
    values,
    setValue,
    linkLabel: create?.link.label ?? '',
    linkOptions: options.map((option) => ({ value: option.recordId, label: option.label })),
    showLinkSelect: options.length > 1,
    linkRecordId,
    setLinkRecordId: setChosenLink,
    linkLoading,
    noLinkOptions: !linkLoading && options.length === 0,
    missingRequired,
    submitting,
    error,
    submit,
  };
};
