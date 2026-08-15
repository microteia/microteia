import { useState, useCallback, useEffect } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';

import { useT } from '../../../shared/i18n/useT';
export interface OfficeFormData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
}

export interface OfficeTabViewModel {
  isAdmin: boolean;
  officeForm: OfficeFormData;
  isSaving: boolean;
  setOfficeForm: (data: Partial<OfficeFormData>) => void;
  handleSave: () => Promise<void>;
}

export const useOfficeTabViewModel = (): OfficeTabViewModel => {
  const t = useT('core.admin');
  const { currentTenant, tenantRole, updateTenant } = useTenant();
  const { notify } = useNotification();
  
  const isAdmin = tenantRole === 'admin';

  const [officeForm, setOfficeFormState] = useState<OfficeFormData>({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local form state when the async-loaded tenant becomes available/changes is architecturally required
    setOfficeFormState({
      name: currentTenant.name ?? '',
      cnpj: currentTenant.cnpj ?? '',
      email: currentTenant.email ?? '',
      phone: currentTenant.phone ?? '',
      address: currentTenant.address ?? '',
    });
  }, [currentTenant]);

  const setOfficeForm = useCallback((data: Partial<OfficeFormData>) => {
    setOfficeFormState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!officeForm.name.trim()) {
      notify(t('office.name.required'), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await updateTenant({
        name: officeForm.name.trim(),
        cnpj: officeForm.cnpj || null,
        email: officeForm.email || null,
        phone: officeForm.phone || null,
        address: officeForm.address || null,
        updatedAt: new Date(),
      });
      notify(t('office.saved'), 'success');
    } catch {
      notify(t('office.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [officeForm, updateTenant, notify, t]);

  return {
    isAdmin,
    officeForm,
    isSaving,
    setOfficeForm,
    handleSave,
  };
};
