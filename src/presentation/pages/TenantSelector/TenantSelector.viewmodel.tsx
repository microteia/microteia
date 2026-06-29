import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { useAuth } from '../../../stores/useAuth';
import { makeCreateTenantUseCase } from '../../../domain/usecases/tenants/CreateTenantUseCase';
import { makeAddTenantMemberUseCase } from '../../../domain/usecases/tenants/ManageTenantMembersUseCase';
import type { Tenant } from '../../../domain/entities';

export interface TenantSelectorViewModel {
  availableTenants: Tenant[];
  selectedTenantId: string | null;
  isLoading: boolean;
  isCreating: boolean;
  newTenantName: string;
  showCreateForm: boolean;
  setNewTenantName: (name: string) => void;
  setShowCreateForm: (show: boolean) => void;
  handleSelectAndContinue: () => void;
  handleSelectTenant: (tenantId: string) => void;
  handleCreateTenant: () => Promise<void>;
}

export const useTenantSelectorViewModel = (): TenantSelectorViewModel => {
  const navigate = useNavigate();
  const { availableTenants, selectTenant, isLoading } = useTenant();
  const { user } = useAuth();
  const { tenantRepository } = useDI();
  const { notify } = useNotification();

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    availableTenants[0]?.id ?? null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleSelectTenant = useCallback((tenantId: string) => {
    setSelectedTenantId(tenantId);
  }, []);

  const handleSelectAndContinue = useCallback(() => {
    if (!selectedTenantId) return;
    void selectTenant(selectedTenantId).then(() => navigate('/'));
  }, [selectedTenantId, selectTenant, navigate]);

  const handleCreateTenant = useCallback(async () => {
    if (!user || !newTenantName.trim()) return;
    setIsCreating(true);
    try {
      const ucCreate = makeCreateTenantUseCase(tenantRepository);
      const ucAddMember = makeAddTenantMemberUseCase(tenantRepository);

      const tenant = await ucCreate.execute({
        name: newTenantName.trim(),
        ownerId: user.id,
        cnpj: null,
        email: user.email,
        phone: null,
        address: null,
        logoURL: null,
      });

      await ucAddMember.execute(tenant.id, {
        userId: user.id,
        tenantId: tenant.id,
        role: 'admin',
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        addedBy: user.id,
      });

      await selectTenant(tenant.id);
      notify('Escritório criado com sucesso!', 'success');
      navigate('/');
    } catch {
      notify('Erro ao criar escritório. Tente novamente.', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [user, newTenantName, tenantRepository, selectTenant, notify, navigate]);

  return {
    availableTenants,
    selectedTenantId,
    isLoading,
    isCreating,
    newTenantName,
    showCreateForm,
    setNewTenantName,
    setShowCreateForm,
    handleSelectTenant,
    handleSelectAndContinue,
    handleCreateTenant,
  };
};
