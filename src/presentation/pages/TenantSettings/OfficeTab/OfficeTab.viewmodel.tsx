import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { PERMISSION_TENANT_UPDATE } from '../../../../domain/schema/access';
import { useNotification } from '../../../../stores/useNotification';
import { useEntityFormFields } from '../../../shared/useEntityFormFields';
import { collectRequiredErrors, setValueByPath } from '../../../../domain/services/customFieldValues';
import { useT } from '../../../shared/i18n/useT';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeUploadTenantLogoUseCase } from '../../../../domain/usecases/tenants/UploadTenantLogoUseCase';
import { TENANT_LOGO_MAX_BYTES } from '../../../../domain/schema/tenantBranding';

/** O `<input type="file">` do logo, aberto pelo botão — sem ref lida no render. */
export const TENANT_LOGO_INPUT_ID = 'tenant-logo-file-input';

export type OfficeValues = Record<string, CustomFieldValue>;

export interface OfficeTabViewModel {
  isAdmin: boolean;
  fields: FieldDefinition[];
  values: OfficeValues;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  handleSave: () => Promise<void>;
  /** O logo do escritório — o do topo do portal e do cabeçalho dos e-mails. */
  logoURL: string | null;
  logoBusy: boolean;
  logoError: string | null;
  cropSrc: string | null;
  chooseLogo: () => void;
  handleLogoFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  confirmLogoCrop: (image: Blob) => Promise<void>;
  cancelLogoCrop: () => void;
  removeLogo: () => Promise<void>;
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
  const { currentTenant, updateTenant } = useTenant();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { fields } = useEntityFormFields('tenant');
  const { tenantRepository } = useDI();
  const uploadLogoUC = useMemo(() => makeUploadTenantLogoUseCase(tenantRepository), [tenantRepository]);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const isAdmin = can(PERMISSION_TENANT_UPDATE);

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

  const chooseLogo = useCallback(() => {
    (document.getElementById(TENANT_LOGO_INPUT_ID) as HTMLInputElement | null)?.click();
  }, []);

  const handleLogoFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError(t('office.logo.invalid'));
      return;
    }
    if (file.size > TENANT_LOGO_MAX_BYTES * 4) {
      // O arquivo original pode ser maior: o recorte reduz. Acima disso, nem o recorte salva.
      setLogoError(t('office.logo.too-large'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (loaded) => {
      if (loaded.target?.result) setCropSrc(loaded.target.result as string);
    };
    reader.readAsDataURL(file);
  }, [t]);

  const confirmLogoCrop = useCallback(async (image: Blob) => {
    if (!currentTenant) return;
    setCropSrc(null);
    if (image.size > TENANT_LOGO_MAX_BYTES) {
      setLogoError(t('office.logo.too-large'));
      return;
    }
    setLogoBusy(true);
    try {
      const logoURL = await uploadLogoUC.execute(currentTenant.id, image);
      await updateTenant({ logoURL });
      notify(t('office.logo.saved'), 'success');
    } catch {
      setLogoError(t('office.logo.failed'));
    } finally {
      setLogoBusy(false);
    }
  }, [currentTenant, uploadLogoUC, updateTenant, notify, t]);

  const removeLogo = useCallback(async () => {
    setLogoBusy(true);
    try {
      await updateTenant({ logoURL: null });
      notify(t('office.logo.removed'), 'success');
    } catch {
      setLogoError(t('office.logo.failed'));
    } finally {
      setLogoBusy(false);
    }
  }, [updateTenant, notify, t]);

  return {
    logoURL: currentTenant?.logoURL ?? null,
    logoBusy,
    logoError,
    cropSrc,
    chooseLogo,
    handleLogoFile,
    confirmLogoCrop,
    cancelLogoCrop: () => setCropSrc(null),
    removeLogo,
    isAdmin,
    fields,
    values,
    fieldErrors,
    isSaving,
    setFieldValue,
    handleSave,
  };
};
