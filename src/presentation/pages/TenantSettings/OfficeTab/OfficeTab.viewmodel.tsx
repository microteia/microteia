import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';
import { useEntityFormFields } from '../../../shared/useEntityFormFields';
import { collectRequiredErrors, setValueByPath } from '../../../../domain/services/customFieldValues';
import { useT } from '../../../shared/i18n/useT';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';

export type OfficeValues = Record<string, CustomFieldValue>;

export interface OfficeTabViewModel {
  isAdmin: boolean;
  fields: FieldDefinition[];
  values: OfficeValues;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  handleSave: () => Promise<void>;
}

/**
 * O escritório NÃO é um registro de subcoleção: ele é o documento `tenants/{tenantId}`. Por isso a
 * aba não passa pelo runtime de registro — ela lê o escritório em vigor e grava por `updateTenant`.
 *
 * O que ela ganhou ao virar plugin é o FORMULÁRIO: os campos vêm da entidade `tenant` do registro,
 * pelo mesmo `deriveFormFields` das demais telas, então um campo criado no Form Design aparece aqui
 * e grava na raiz do documento — sem uma linha a mais neste arquivo.
 */
export const useOfficeTabViewModel = (): OfficeTabViewModel => {
  const t = useT('core.tenant');
  const { currentTenant, tenantRole, updateTenant } = useTenant();
  const { notify } = useNotification();
  const { fields } = useEntityFormFields('tenant');

  const isAdmin = tenantRole === 'admin';

  const [values, setValues] = useState<OfficeValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // O escritório chega assíncrono e troca quando o usuário muda de organização; o formulário é
  // estado local porque o usuário digita nele antes de gravar.
  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizar o formulário com o escritório carregado de forma assíncrona é a razão do efeito
    setValues({ ...(currentTenant as unknown as OfficeValues) });
  }, [currentTenant]);

  const editableKeys = useMemo(() => new Set(fields.map((field) => field.key)), [fields]);

  const setFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setValues((prev) => setValueByPath(prev, fieldKey, value) as OfficeValues);
    setFieldErrors((prev) => {
      if (!(fieldKey in prev)) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const errors = collectRequiredErrors(t, fields, values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      notify(t('office.required'), 'error');
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      // Só o que o formulário DECLARA vai no payload: `memberCount`, `plan` e companhia estão no
      // mesmo objeto de leitura e são recusados pelas regras do Firestore se forem junto.
      const payload: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of editableKeys) {
        const value = values[key];
        payload[key] = value === '' ? null : value;
      }
      await updateTenant(payload);
      notify(t('office.saved'), 'success');
    } catch {
      notify(t('office.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [fields, values, editableKeys, updateTenant, notify, t]);

  return {
    isAdmin,
    fields,
    values,
    fieldErrors,
    isSaving,
    setFieldValue,
    handleSave,
  };
};
