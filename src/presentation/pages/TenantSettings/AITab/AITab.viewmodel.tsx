import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetAIConnectionsUseCase } from '../../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { makeCreateAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/CreateAIConnectionUseCase';
import { makeUpdateAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/UpdateAIConnectionUseCase';
import { makeDeleteAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/DeleteAIConnectionUseCase';
import { makeSetDefaultAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/SetDefaultAIConnectionUseCase';
import type { AIConnection, AIProvider } from '../../../../domain/entities';

export interface AIConnectionForm {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
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

export interface AITabViewModel {
  loading: boolean;
  connections: AIConnection[];
  error: string | null;
  showModal: boolean;
  modalEditing: AIConnection | null;
  form: AIConnectionForm;
  saving: boolean;
  showApiKey: boolean;
  apiKeyRequired: boolean;
  canSave: boolean;
  modelSuggestions: string[];
  confirmDelete: { open: boolean; id: string; name: string };
  handleFormChange: (field: keyof AIConnectionForm, value: string) => void;
  handleOpenModal: (connection?: AIConnection) => void;
  handleCloseModal: () => void;
  handleSave: () => Promise<void>;
  handleDelete: (id: string) => void;
  handleSetDefault: (id: string) => Promise<void>;
  handleToggleShowApiKey: () => void;
  runDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useAITabViewModel = (): AITabViewModel => {
  const { currentTenant } = useTenant();
  const { aiConnectionRepository } = useDI();

  const getConnectionsUC = useMemo(() => makeGetAIConnectionsUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const createConnectionUC = useMemo(() => makeCreateAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const updateConnectionUC = useMemo(() => makeUpdateAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const deleteConnectionUC = useMemo(() => makeDeleteAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);
  const setDefaultConnectionUC = useMemo(() => makeSetDefaultAIConnectionUseCase(aiConnectionRepository), [aiConnectionRepository]);

  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalEditing, setModalEditing] = useState<AIConnection | null>(null);
  const [form, setForm] = useState<AIConnectionForm>(EMPTY_AI_FORM);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: '', name: '' });

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation is architecturally required
    setLoading(true);
    const load = async () => {
      try {
        const result = await getConnectionsUC.execute(currentTenant.id);
        if (result.length === 1 && !result[0].isDefault) {
          await setDefaultConnectionUC.execute(currentTenant.id, result[0].id);
          setConnections([{ ...result[0], isDefault: true }]);
        } else {
          setConnections(result);
        }
      } catch {
        setError('Erro ao carregar conexões IA.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentTenant, getConnectionsUC, setDefaultConnectionUC]);

  const modelSuggestions = useMemo(
    () => MODEL_SUGGESTIONS[form.provider] ?? [],
    [form.provider],
  );

  const apiKeyRequired = useMemo(() => !modalEditing || !modalEditing.hasApiKey, [modalEditing]);

  const canSave = useMemo(
    () => Boolean(form.name.trim() && form.provider && (!apiKeyRequired || form.apiKey.trim())),
    [form.name, form.provider, form.apiKey, apiKeyRequired],
  );

  const handleFormChange = useCallback((field: keyof AIConnectionForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'provider') next.model = '';
      return next;
    });
  }, []);

  const handleOpenModal = useCallback((connection?: AIConnection) => {
    if (connection) {
      setModalEditing(connection);
      setForm({
        name: connection.name,
        provider: connection.provider,
        apiKey: '',
        model: connection.model,
        temperature: String(connection.temperature),
        maxTokens: String(connection.maxTokens),
      });
    } else {
      setModalEditing(null);
      setForm(EMPTY_AI_FORM);
    }
    setShowApiKey(false);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalEditing(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentTenant || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const apiKey = form.apiKey.trim();
      const data = {
        name: form.name.trim(),
        provider: form.provider as AIProvider,
        model: form.model,
        temperature: parseFloat(form.temperature) || 0.7,
        maxTokens: parseInt(form.maxTokens, 10) || 2048,
        isDefault: modalEditing ? modalEditing.isDefault : connections.length === 0,
      };
      if (modalEditing) {
        await updateConnectionUC.execute(currentTenant.id, modalEditing.id, data, apiKey || undefined);
        setConnections((prev) =>
          prev.map((c) =>
            c.id === modalEditing.id ? { ...c, ...data, hasApiKey: c.hasApiKey || Boolean(apiKey) } : c,
          ),
        );
      } else {
        const created = await createConnectionUC.execute(currentTenant.id, data, apiKey);
        setConnections((prev) => [...prev, created]);
      }
      handleCloseModal();
    } catch {
      setError('Erro ao salvar conexão IA.');
    } finally {
      setSaving(false);
    }
  }, [currentTenant, canSave, form, modalEditing, connections.length, updateConnectionUC, createConnectionUC, handleCloseModal]);

  const handleDelete = useCallback((id: string) => {
    const conn = connections.find((c) => c.id === id);
    if (conn) setConfirmDelete({ open: true, id, name: conn.name });
  }, [connections]);

  const runDelete = useCallback(async () => {
    if (!currentTenant) return;
    const { id } = confirmDelete;
    try {
      await deleteConnectionUC.execute(currentTenant.id, id);
      const remaining = connections.filter((c) => c.id !== id);
      if (remaining.length === 1 && !remaining[0].isDefault) {
        await setDefaultConnectionUC.execute(currentTenant.id, remaining[0].id);
        setConnections(remaining.map((c) => ({ ...c, isDefault: true })));
      } else {
        setConnections(remaining);
      }
    } catch {
      setError('Erro ao excluir conexão.');
    } finally {
      setConfirmDelete({ open: false, id: '', name: '' });
    }
  }, [currentTenant, confirmDelete, deleteConnectionUC, connections, setDefaultConnectionUC]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete({ open: false, id: '', name: '' });
  }, []);

  const handleSetDefault = useCallback(async (id: string) => {
    if (!currentTenant) return;
    try {
      await setDefaultConnectionUC.execute(currentTenant.id, id);
      setConnections((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    } catch {
      setError('Erro ao definir conexão padrão.');
    }
  }, [currentTenant, setDefaultConnectionUC]);

  const handleToggleShowApiKey = useCallback(() => setShowApiKey((v) => !v), []);

  return {
    loading,
    connections,
    error,
    showModal,
    modalEditing,
    form,
    saving,
    showApiKey,
    apiKeyRequired,
    canSave,
    modelSuggestions,
    confirmDelete,
    handleFormChange,
    handleOpenModal,
    handleCloseModal,
    handleSave,
    handleDelete,
    handleSetDefault,
    handleToggleShowApiKey,
    runDelete,
    cancelDelete,
  };
};
