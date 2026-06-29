import { useState, useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';

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
  const { currentTenant, tenantRole, updateTenant } = useTenant();
  const { notify } = useNotification();
  
  const isAdmin = tenantRole === 'admin';

  const [officeForm, setOfficeFormState] = useState<OfficeFormData>(() => ({
    name: currentTenant?.name ?? '',
    cnpj: currentTenant?.cnpj ?? '',
    email: currentTenant?.email ?? '',
    phone: currentTenant?.phone ?? '',
    address: currentTenant?.address ?? '',
  }));
  const [isSaving, setIsSaving] = useState(false);

  const setOfficeForm = useCallback((data: Partial<OfficeFormData>) => {
    setOfficeFormState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!officeForm.name.trim()) {
      notify('Nome do escritório é obrigatório.', 'error');
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
      notify('Escritório atualizado com sucesso!', 'success');
    } catch {
      notify('Erro ao atualizar escritório.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [officeForm, updateTenant, notify]);

  return {
    isAdmin,
    officeForm,
    isSaving,
    setOfficeForm,
    handleSave,
  };
};
