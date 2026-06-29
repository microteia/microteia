import { useState, useCallback, useMemo } from 'react';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetAIConnectionsUseCase } from '../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { makeCreateAIConnectionUseCase } from '../../../domain/usecases/aiconnections/CreateAIConnectionUseCase';
import { makeUpdateAIConnectionUseCase } from '../../../domain/usecases/aiconnections/UpdateAIConnectionUseCase';
import { makeDeleteAIConnectionUseCase } from '../../../domain/usecases/aiconnections/DeleteAIConnectionUseCase';
import { makeSetDefaultAIConnectionUseCase } from '../../../domain/usecases/aiconnections/SetDefaultAIConnectionUseCase';
import { useEffect } from 'react';
import type { AIConnection, AIProvider, TenantMember, TenantRole } from '../../../domain/entities';

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  admin: 'Administrador',
  lawyer: 'Advogado',
  secretary: 'Secretário(a)',
  user: 'Usuário',
};

export interface OfficeFormData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
}

export interface AIConnectionForm {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
}

export type TenantSettingsTab = 'office' | 'members' | 'ai';

export interface TenantSettingsViewModel {
  isAdmin: boolean;
  activeTab: TenantSettingsTab;
  setActiveTab: (tab: TenantSettingsTab) => void;

  officeForm: OfficeFormData;
  isSavingOffice: boolean;
  setOfficeForm: (data: Partial<OfficeFormData>) => void;
  handleSaveOffice: () => Promise<void>;

  members: TenantMember[];
  isLoading: boolean;
  tenantOwnerId: string;
  currentUserId: string;
  addEmail: string;
  addRole: TenantRole;
  isAddingMember: boolean;
  memberToRemove: TenantMember | null;
  setAddEmail: (v: string) => void;
  setAddRole: (v: TenantRole) => void;
  handleAddMember: () => Promise<void>;
  handleRoleChange: (member: TenantMember, role: TenantRole) => Promise<void>;
  handleRemoveMember: (member: TenantMember) => void;
  confirmRemoveMember: () => Promise<void>;
  cancelRemoveMember: () => void;

  aiLoading: boolean;
  aiConnections: AIConnection[];
  aiError: string | null;
  showAIModal: boolean;
  aiModalEditing: AIConnection | null;
  aiForm: AIConnectionForm;
  aiSaving: boolean;
  showApiKey: boolean;
  modelSuggestions: string[];
  handleAIFormChange: (field: keyof AIConnectionForm, value: string) => void;
  handleOpenAIModal: (connection?: AIConnection) => void;
  handleCloseAIModal: () => void;
  handleSaveAIConnection: () => Promise<void>;
  handleDeleteAIConnection: (id: string) => void;
  handleSetDefaultAIConnection: (id: string) => Promise<void>;
  handleToggleShowApiKey: () => void;
  confirmAIDelete: { open: boolean; id: string; name: string };
  runDeleteAI: () => Promise<void>;
  cancelDeleteAI: () => void;
}

const EMPTY_AI_FORM: AIConnectionForm = {
  name: '',
  provider: 'openai',
  apiKey: '',
  model: '',
  temperature: '0.7',
  maxTokens: '2048',
};

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'open-mistral-7b'],
  cohere: ['command-r-plus', 'command-r', 'command'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'gemma2', 'phi4'],
  other: [],
};

export const useTenantSettingsViewModel = (initialTab: TenantSettingsTab = 'office'): TenantSettingsViewModel => {
  const { currentTenant, members, isLoading, tenantRole, updateTenant, addMember, updateMemberRole, removeMember } = useTenant();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { userRepository, aiConnectionRepository } = useDI();

  const isAdmin = tenantRole === 'admin';

  const getConnectionsUC = useMemo(() => makeGetAIConnectionsUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const createConnectionUC = useMemo(() => makeCreateAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const updateConnectionUC = useMemo(() => makeUpdateAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const deleteConnectionUC = useMemo(() => makeDeleteAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const setDefaultConnectionUC = useMemo(() => makeSetDefaultAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);

  const [activeTab, setActiveTab] = useState<TenantSettingsTab>(initialTab);
  const [officeForm, setOfficeFormState] = useState<OfficeFormData>({
    name: currentTenant?.name ?? '',
    cnpj: currentTenant?.cnpj ?? '',
    email: currentTenant?.email ?? '',
    phone: currentTenant?.phone ?? '',
    address: currentTenant?.address ?? '',
  });
  const [isSavingOffice, setIsSavingOffice] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<TenantRole>('user');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TenantMember | null>(null);

  const [aiConnections, setAIConnections] = useState<AIConnection[]>([]);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiModalEditing, setAIModalEditing] = useState<AIConnection | null>(null);
  const [aiForm, setAIForm] = useState<AIConnectionForm>(EMPTY_AI_FORM);
  const [aiSaving, setAISaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmAIDelete, setConfirmAIDelete] = useState({ open: false, id: '', name: '' });

  useEffect(() => {
    if (!currentTenant || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation is architecturally required
    setAILoading(true);
    const load = async () => {
      try {
        const connections = await getConnectionsUC.execute(currentTenant.id);
        if (connections.length === 1 && !connections[0].isDefault) {
          await setDefaultConnectionUC.execute(currentTenant.id, connections[0].id);
          setAIConnections([{ ...connections[0], isDefault: true }]);
        } else {
          setAIConnections(connections);
        }
      } catch {
        setAIError('Erro ao carregar conexões IA.');
      } finally {
        setAILoading(false);
      }
    };
    void load();
  }, [currentTenant, isAdmin, getConnectionsUC, setDefaultConnectionUC]);

  const setOfficeForm = useCallback((data: Partial<OfficeFormData>) => {
    setOfficeFormState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSaveOffice = useCallback(async () => {
    if (!officeForm.name.trim()) { notify('Nome do escritório é obrigatório.', 'error'); return; }
    setIsSavingOffice(true);
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
      setIsSavingOffice(false);
    }
  }, [officeForm, updateTenant, notify]);

  const handleAddMember = useCallback(async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) { notify('Informe o e-mail do usuário.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notify('E-mail inválido.', 'error'); return; }

    setIsAddingMember(true);
    try {
      const found = await userRepository.getUserByEmail(email);
      if (!found) {
        notify('Nenhum usuário cadastrado com esse e-mail.', 'error');
        return;
      }
      const alreadyMember = members.some((m) => m.userId === found.id);
      if (alreadyMember) {
        notify('Este usuário já é membro do escritório.', 'error');
        return;
      }
      await addMember({
        userId: found.id,
        tenantId: currentTenant?.id ?? '',
        role: addRole,
        displayName: found.displayName,
        email: found.email,
        photoURL: found.photoURL ?? null,
        addedBy: user?.id ?? '',
      });
      notify('Membro adicionado com sucesso!', 'success');
      setAddEmail('');
      setAddRole('user');
    } catch {
      notify('Erro ao adicionar membro.', 'error');
    } finally {
      setIsAddingMember(false);
    }
  }, [addEmail, addRole, addMember, currentTenant, user, members, userRepository, notify]);

  const handleRoleChange = useCallback(async (member: TenantMember, role: TenantRole) => {
    try {
      await updateMemberRole(member.userId, role);
      notify('Permissão atualizada.', 'success');
    } catch {
      notify('Erro ao atualizar permissão.', 'error');
    }
  }, [updateMemberRole, notify]);

  const handleRemoveMember = useCallback((member: TenantMember) => {
    setMemberToRemove(member);
  }, []);

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) return;
    try {
      await removeMember(memberToRemove.userId);
      notify('Membro removido do escritório.', 'success');
    } catch {
      notify('Erro ao remover membro.', 'error');
    } finally {
      setMemberToRemove(null);
    }
  }, [memberToRemove, removeMember, notify]);

  const cancelRemoveMember = useCallback(() => setMemberToRemove(null), []);

  const modelSuggestions = useMemo(
    () => MODEL_SUGGESTIONS[aiForm.provider] ?? [],
    [aiForm.provider],
  );

  const handleAIFormChange = useCallback((field: keyof AIConnectionForm, value: string) => {
    setAIForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'provider') next.model = '';
      return next;
    });
  }, []);

  const handleOpenAIModal = useCallback((connection?: AIConnection) => {
    if (connection) {
      setAIModalEditing(connection);
      setAIForm({
        name: connection.name,
        provider: connection.provider,
        apiKey: connection.apiKey,
        model: connection.model,
        temperature: String(connection.temperature),
        maxTokens: String(connection.maxTokens),
      });
    } else {
      setAIModalEditing(null);
      setAIForm(EMPTY_AI_FORM);
    }
    setShowApiKey(false);
    setShowAIModal(true);
  }, []);

  const handleCloseAIModal = useCallback(() => {
    setShowAIModal(false);
    setAIModalEditing(null);
  }, []);

  const handleSaveAIConnection = useCallback(async () => {
    if (!currentTenant || !aiForm.name.trim() || !aiForm.provider) return;
    setAISaving(true);
    setAIError(null);
    try {
      const data = {
        name: aiForm.name.trim(),
        provider: aiForm.provider as AIProvider,
        apiKey: aiForm.apiKey,
        model: aiForm.model,
        temperature: parseFloat(aiForm.temperature) || 0.7,
        maxTokens: parseInt(aiForm.maxTokens, 10) || 2048,
        isDefault: aiConnections.length === 0 && !aiModalEditing,
      };
      if (aiModalEditing) {
        await updateConnectionUC.execute(currentTenant.id, aiModalEditing.id, data);
        setAIConnections((prev) => prev.map((c) => (c.id === aiModalEditing.id ? { ...c, ...data } : c)));
      } else {
        const created = await createConnectionUC.execute(currentTenant.id, data);
        setAIConnections((prev) => [...prev, created]);
      }
      handleCloseAIModal();
    } catch {
      setAIError('Erro ao salvar conexão IA.');
    } finally {
      setAISaving(false);
    }
  }, [currentTenant, aiForm, aiModalEditing, aiConnections.length, updateConnectionUC, createConnectionUC, handleCloseAIModal]);

  const handleDeleteAIConnection = useCallback((id: string) => {
    const conn = aiConnections.find((c) => c.id === id);
    if (conn) setConfirmAIDelete({ open: true, id, name: conn.name });
  }, [aiConnections]);

  const runDeleteAI = useCallback(async () => {
    if (!currentTenant) return;
    const { id } = confirmAIDelete;
    try {
      await deleteConnectionUC.execute(currentTenant.id, id);
      const remaining = aiConnections.filter((c) => c.id !== id);
      if (remaining.length === 1 && !remaining[0].isDefault) {
        await setDefaultConnectionUC.execute(currentTenant.id, remaining[0].id);
        setAIConnections(remaining.map((c) => ({ ...c, isDefault: true })));
      } else {
        setAIConnections(remaining);
      }
    } catch {
      setAIError('Erro ao excluir conexão.');
    } finally {
      setConfirmAIDelete({ open: false, id: '', name: '' });
    }
  }, [currentTenant, confirmAIDelete, deleteConnectionUC, aiConnections, setDefaultConnectionUC]);

  const cancelDeleteAI = useCallback(() => {
    setConfirmAIDelete({ open: false, id: '', name: '' });
  }, []);

  const handleSetDefaultAIConnection = useCallback(async (id: string) => {
    if (!currentTenant) return;
    try {
      await setDefaultConnectionUC.execute(currentTenant.id, id);
      setAIConnections((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    } catch {
      setAIError('Erro ao definir conexão padrão.');
    }
  }, [currentTenant, setDefaultConnectionUC]);

  const handleToggleShowApiKey = useCallback(() => setShowApiKey((v) => !v), []);

  return {
    isAdmin,
    activeTab,
    setActiveTab,

    officeForm,
    isSavingOffice,
    setOfficeForm,
    handleSaveOffice,

    members,
    isLoading,
    tenantOwnerId: currentTenant?.ownerId ?? '',
    currentUserId: user?.id ?? '',
    addEmail,
    addRole,
    isAddingMember,
    memberToRemove,
    setAddEmail,
    setAddRole,
    handleAddMember,
    handleRoleChange,
    handleRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,

    aiLoading,
    aiConnections,
    aiError,
    showAIModal,
    aiModalEditing,
    aiForm,
    aiSaving,
    showApiKey,
    modelSuggestions,
    handleAIFormChange,
    handleOpenAIModal,
    handleCloseAIModal,
    handleSaveAIConnection,
    handleDeleteAIConnection,
    handleSetDefaultAIConnection,
    handleToggleShowApiKey,
    confirmAIDelete,
    runDeleteAI,
    cancelDeleteAI,
  };
};
