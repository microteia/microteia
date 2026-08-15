import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  setValueByPath,
  sortFieldsByOrder,
} from '../../../domain/services/customFieldValues';
import type { CustomFieldValue, FieldDefinition, ScreenDefinition } from '../../../domain/entities';

import { useT } from '../i18n/useT';
type Values = Record<string, CustomFieldValue>;

export interface EntityForm {
  screen: ScreenDefinition | null;
  screenKey: string;
  fields: FieldDefinition[];
  isNew: boolean;
  values: Values;
  getValue: (fieldKey: string) => CustomFieldValue;
  setValue: (fieldKey: string, value: CustomFieldValue) => void;
  errors: Record<string, string>;
  validate: () => boolean;
  save: () => Promise<{ id: string } | null>;
  isSaving: boolean;
}

/**
 * Estado + gravação de um formulário de criar/editar de uma entidade dinâmica, resolvido pelo
 * `sourceId`. É o motor que uma view de código usa para RECRIAR a tela de edição com layout próprio:
 * ela dispõe os `fields` como quiser (`FieldInput` por campo, ou `EntityForm` inteiro), lê/escreve por
 * `values`/`setValue` e chama `save()`. O TIPO/máscara/opções de cada campo continuam vindo do schema
 * (Form Design); aqui só mora o estado, a validação de obrigatórios e o upsert na coleção da tela.
 */
export const useEntityForm = (sourceId: string, recordId?: string | null): EntityForm => {
  const t = useT('core.records');
  const { dynamicScreens } = useScreenDefinitions();
  const { recordsByCollection, createRecord, updateRecord } = useRecords();

  const screen = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId) ?? null,
    [dynamicScreens, sourceId],
  );
  const screenKey = screen?.id ?? '';
  const fields = useMemo(() => (screen ? sortFieldsByOrder(screen.fields) : []), [screen]);
  const isNew = !recordId;

  const record = useMemo(
    () => (recordId ? (recordsByCollection[screenKey] ?? []).find((r) => r.id === recordId) ?? null : null),
    [recordId, recordsByCollection, screenKey],
  );

  const [values, setValues] = useState<Values>(() => buildInitialFormValues(fields, record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ressincroniza ao carregar tela/registro
    setValues(buildInitialFormValues(fields, record));
  }, [fields, record, isDirty]);

  const getValue = useCallback((fieldKey: string) => values[fieldKey], [values]);

  const setValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setValues((prev) => setValueByPath(prev, fieldKey, value));
    setIsDirty(true);
    setErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const validate = useCallback(() => {
    const found = collectRequiredErrors(t, fields, values);
    setErrors(found);
    return Object.keys(found).length === 0;
  }, [fields, values, t]);

  const save = useCallback(async (): Promise<{ id: string } | null> => {
    const found = collectRequiredErrors(t, fields, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return null;
    }
    setErrors({});
    if (!screenKey) return null;
    const stored = formValuesToStoredValues(fields, values);
    setIsSaving(true);
    try {
      if (isNew) {
        const created = await createRecord(screenKey, stored);
        setIsDirty(false);
        return { id: created.id };
      }
      if (record) {
        await updateRecord(screenKey, record.id, stored);
        setIsDirty(false);
        return { id: record.id };
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [fields, values, screenKey, isNew, record, createRecord, updateRecord, t]);

  return { screen, screenKey, fields, isNew, values, getValue, setValue, errors, validate, save, isSaving };
};
