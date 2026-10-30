import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { usePortal } from '../../../../../stores/usePortal';
import { resolveColor } from '../../../../../shared/styles/colorUtils';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import type { PortalFieldInfo, PortalLinkOption, PortalScreenInfo } from '../../../../../domain/entities/Portal';
import { applyMaskTemplate, maskPlaceholder } from '../../../../../domain/schema/fieldRulePresets';
import { makeDeclarativeLookupService } from '../../../../../data/services/DeclarativeLookupService';
import { useExternalLookupRunner } from '../../../../shared/useExternalLookupRunner';

export interface PortalCreateFormProps {
  screen: PortalScreenInfo;
  /** Criado DENTRO de um registro: o pai já é este, e não há o que escolher. */
  fixedLinkRecordId?: string | null;
  /** ALTERA este registro, partindo do que o convidado vê dele — sem vínculo a escolher. */
  editing?: { recordId: string; values: Record<string, unknown> } | null;
  onCancel: () => void;
  onSubmitted: () => void;
}

export interface PortalCreateFormViewModel {
  isEditing: boolean;
  fields: PortalFieldInfo[];
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  /** As opções de um `select`, com a cor já resolvida pelo tema. */
  selectOptions: (field: PortalFieldInfo) => SearchSelectOption[];
  /** Um campo `masked` pronto para desenhar: o valor no molde do preset, quando o escritório o tem. */
  maskedInput: (field: PortalFieldInfo) => { value: string; placeholder: string; inputMode: 'numeric' | 'text' };
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

const textOf = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

export const usePortalCreateFormViewModel = ({ screen, fixedLinkRecordId, editing, onSubmitted }: PortalCreateFormProps): PortalCreateFormViewModel => {
  const { listLinkOptions, submit: submitRecord, update: updateRecord } = usePortal();
  const theme = useTheme();
  const create = screen.create;
  const isEditing = !!editing;
  const noLinkNeeded = isEditing || !!fixedLinkRecordId;

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!editing) return {};
    return Object.fromEntries((screen.edit?.fields ?? []).map((field) => [field.key, editing.values[field.key]]));
  });
  const [options, setOptions] = useState<PortalLinkOption[]>([]);
  const [linkLoading, setLinkLoading] = useState(!noLinkNeeded);
  const [chosenLink, setChosenLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkCollection = noLinkNeeded ? '' : create?.link.collection ?? '';

  useEffect(() => {
    if (!linkCollection) return;
    let active = true;
    listLinkOptions(linkCollection)
      .then((loaded) => { if (active) setOptions(loaded); })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setLinkLoading(false); });
    return () => { active = false; };
  }, [linkCollection, listLinkOptions]);

  const linkRecordId = fixedLinkRecordId || chosenLink || (options.length === 1 ? options[0].recordId : '');
  const fields = useMemo(
    () => (isEditing ? screen.edit?.fields ?? [] : create?.fields ?? []),
    [isEditing, screen.edit, create],
  );
  const missingRequired = fields.some((field) => field.required && isEmpty(values[field.key]));

  // A resposta de uma busca só preenche o que o convidado pode escrever: sem `map`, o provedor devolve
  // as chaves dele (prefixadas ou cruas), e uma chave fora dos preenchíveis o servidor descartaria.
  const fillableKeys = useMemo(() => new Set(fields.map((field) => field.key)), [fields]);
  const mergeValues = useCallback((patch: Record<string, unknown>) => {
    const accepted = Object.entries(patch).filter(([key]) => fillableKeys.has(key));
    if (accepted.length > 0) setValues((prev) => ({ ...prev, ...Object.fromEntries(accepted) }));
  }, [fillableKeys]);
  const { scheduleLookup } = useExternalLookupRunner(fillableKeys, mergeValues);
  const lookupServices = useMemo(() => new Map(fields.flatMap((field) =>
    (field.lookup ? [[field.key, makeDeclarativeLookupService(field.lookup.provider)] as const] : []))), [fields]);

  const setValue = useCallback((key: string, value: unknown) => {
    const field = fields.find((candidate) => candidate.key === key);
    const next = field?.mask && typeof value === 'string' ? applyMaskTemplate(value, field.mask.templates) : value;
    setValues((prev) => ({ ...prev, [key]: next }));
    const service = lookupServices.get(key);
    if (field?.lookup && service) scheduleLookup({ fieldKey: key, value: next, service, binding: field.lookup.binding });
  }, [fields, lookupServices, scheduleLookup]);

  const maskedInput = useCallback((field: PortalFieldInfo) => {
    const text = textOf(values[field.key]);
    if (!field.mask) return { value: text, placeholder: '', inputMode: 'text' as const };
    return {
      value: applyMaskTemplate(text, field.mask.templates),
      placeholder: maskPlaceholder(field.mask),
      inputMode: field.mask.inputMode ?? 'text',
    };
  }, [values]);

  const selectOptions = useCallback((field: PortalFieldInfo): SearchSelectOption[] =>
    (field.options ?? []).map((option) => ({
      value: option.key,
      label: option.label,
      color: resolveColor(option.color, theme, false),
    })), [theme]);

  const submit = useCallback(async () => {
    if ((!editing && !linkRecordId) || missingRequired) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        // Na edição, apagar um campo é uma alteração: vai como `null`, e não some do pedido.
        const data = Object.fromEntries(fields.map((field) => [field.key, isEmpty(values[field.key]) ? null : values[field.key]]));
        await updateRecord(screen.collection, editing.recordId, data);
        onSubmitted();
        return;
      }
      const data = Object.fromEntries(Object.entries(values).filter(([, value]) => !isEmpty(value)));
      await submitRecord(screen.collection, linkRecordId, data);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    } finally {
      setSubmitting(false);
    }
  }, [editing, linkRecordId, missingRequired, values, fields, updateRecord, submitRecord, screen.collection, onSubmitted]);

  return {
    isEditing,
    fields,
    values,
    setValue,
    selectOptions,
    maskedInput,
    linkLabel: create?.link.label ?? '',
    linkOptions: options.map((option) => ({ value: option.recordId, label: option.label })),
    showLinkSelect: options.length > 1,
    linkRecordId,
    setLinkRecordId: setChosenLink,
    linkLoading,
    noLinkOptions: !noLinkNeeded && !linkLoading && options.length === 0,
    missingRequired,
    submitting,
    error,
    submit,
  };
};
