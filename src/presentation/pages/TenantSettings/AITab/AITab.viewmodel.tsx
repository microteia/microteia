import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetAIConnectionsUseCase } from '../../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { makeCreateAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/CreateAIConnectionUseCase';
import { makeUpdateAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/UpdateAIConnectionUseCase';
import { makeDeleteAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/DeleteAIConnectionUseCase';
import { makeSetDefaultAIConnectionUseCase } from '../../../../domain/usecases/aiconnections/SetDefaultAIConnectionUseCase';
import type { AIConnection, AIProvider } from '../../../../domain/entities';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';

import { useT } from '../../../shared/i18n/useT';
export interface AIConnectionForm {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
}

export type AIFieldErrors = Partial<Record<keyof AIConnectionForm, string>>;

const EMPTY_AI_FORM: AIConnectionForm = {
  name: '',
  provider: 'openai',
  apiKey: '',
  model: '',
  temperature: '0.7',
  maxTokens: '2048',
};

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna'],
  anthropic: [
    'claude-opus-5-5',
    'claude-sonnet-5-5',
    'claude-haiku-5-5',
    'claude-fable-5-2',
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ],
  google: ['gemini-4-carbon', 'gemini-4-hydrogen', 'gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  mistral: ['mistral-large-4', 'mistral-large-latest', 'mistral-small-latest'],
  cohere: ['command-a-plus-05-2026', 'command-a-03-2025', 'command-r7b-12-2024'],
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
  formError: string | null;
  fieldErrors: AIFieldErrors;
  modelOptions: SearchSelectOption[];
  modelIsFreeText: boolean;
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
  const t = useT('core.tenant');
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
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AIFieldErrors>({});
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
        setError(t('ai.load-failed'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentTenant, getConnectionsUC, setDefaultConnectionUC, t]);

  const modelIsFreeText = useMemo(
    () => (MODEL_SUGGESTIONS[form.provider] ?? []).length === 0,
    [form.provider],
  );

  const modelOptions = useMemo(() => {
    const known = MODEL_SUGGESTIONS[form.provider] ?? [];
    const current = form.model && !known.includes(form.model) ? [form.model] : [];
    return [...known, ...current].map((model) => ({ value: model, label: model }));
  }, [form.provider, form.model]);

  const apiKeyRequired = useMemo(() => !modalEditing || !modalEditing.hasApiKey, [modalEditing]);

  const validate = useCallback((): AIFieldErrors => {
    const required = t('ai.error.required');
    const errors: AIFieldErrors = {};
    if (!form.name.trim()) errors.name = required;
    if (!form.provider) errors.provider = required;
    if (apiKeyRequired && !form.apiKey.trim()) errors.apiKey = required;
    if (!form.model.trim()) errors.model = required;
    const maxTokens = Number(form.maxTokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 1) errors.maxTokens = t('ai.error.max-tokens');
    return errors;
  }, [form, apiKeyRequired, t]);

  const handleFormChange = useCallback((field: keyof AIConnectionForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'provider') next.model = '';
      return next;
    });
    setFormError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      if (field === 'provider') delete next.model;
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
    setFormError(null);
    setFieldErrors({});
    setShowApiKey(false);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalEditing(null);
    setFormError(null);
    setFieldErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentTenant) return;
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError(t('ai.error.form'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const apiKey = form.apiKey.trim();
      const data = {
        name: form.name.trim(),
        provider: form.provider as AIProvider,
        model: form.model.trim(),
        temperature: parseFloat(form.temperature) || 0.7,
        maxTokens: Number(form.maxTokens),
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
      setFormError(t('ai.save-failed'));
    } finally {
      setSaving(false);
    }
  }, [currentTenant, validate, form, modalEditing, connections.length, updateConnectionUC, createConnectionUC, handleCloseModal, t]);

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
      setError(t('ai.delete-failed'));
    } finally {
      setConfirmDelete({ open: false, id: '', name: '' });
    }
  }, [currentTenant, confirmDelete, deleteConnectionUC, connections, setDefaultConnectionUC, t]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete({ open: false, id: '', name: '' });
  }, []);

  const handleSetDefault = useCallback(async (id: string) => {
    if (!currentTenant) return;
    try {
      await setDefaultConnectionUC.execute(currentTenant.id, id);
      setConnections((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    } catch {
      setError(t('ai.set-default-failed'));
    }
  }, [currentTenant, setDefaultConnectionUC, t]);

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
    formError,
    fieldErrors,
    modelOptions,
    modelIsFreeText,
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
