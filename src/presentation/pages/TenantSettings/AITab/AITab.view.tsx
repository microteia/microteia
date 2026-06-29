import React, { useEffect } from 'react';
import { useTheme } from 'styled-components';
import {
  RiDeleteBinLine,
  RiCloseLine,
  RiEditLine,
  RiAddLine,
  RiEyeLine,
  RiEyeOffLine,
  RiStarLine,
  RiRobot2Line,
} from 'react-icons/ri';
import { SiOpenai, SiGoogle } from 'react-icons/si';
import { useAITabViewModel } from './AITab.viewmodel';
import { S } from './AITab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import type { AIConnection } from '../../../../domain/entities';
import type { AIConnectionForm } from './AITab.viewmodel';

const PROVIDER_OPTIONS: SearchSelectOption[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'other', label: 'Outro' },
];

interface AIConnectionCardProps {
  connection: AIConnection;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  providerColor: string;
  providerLabel: string;
  providerIcon: React.ReactNode;
}

const AIConnectionCard: React.FC<AIConnectionCardProps> = ({
  connection,
  onEdit,
  onDelete,
  onSetDefault,
  providerColor,
  providerLabel,
  providerIcon,
}) => {
  return (
    <S.AICard $isDefault={connection.isDefault}>
      <S.AIProviderIcon $color={providerColor}>{providerIcon}</S.AIProviderIcon>
      <S.AICardBody>
        <S.AICardName>
          {connection.name}
          {connection.isDefault && <S.DefaultBadge>Padrão</S.DefaultBadge>}
        </S.AICardName>
        <S.AICardMeta>
          {providerLabel} · {connection.model || 'modelo não definido'} · temp {connection.temperature}
        </S.AICardMeta>
      </S.AICardBody>
      <S.AICardActions>
        {!connection.isDefault && (
          <Button size="sm" variant="ghost" onClick={onSetDefault} title="Definir como padrão">
            <RiStarLine size={16} />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
          <RiEditLine size={16} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir">
          <RiDeleteBinLine size={16} />
        </Button>
      </S.AICardActions>
    </S.AICard>
  );
};

interface AIModalProps {
  form: AIConnectionForm;
  modalEditing: AIConnection | null;
  saving: boolean;
  showApiKey: boolean;
  modelSuggestions: string[];
  handleFormChange: (field: keyof AIConnectionForm, value: string) => void;
  handleCloseModal: () => void;
  handleSave: () => Promise<void>;
  handleToggleShowApiKey: () => void;
}

const AIConnectionModal: React.FC<AIModalProps> = ({
  form,
  modalEditing,
  saving,
  showApiKey,
  modelSuggestions,
  handleFormChange,
  handleCloseModal,
  handleSave,
  handleToggleShowApiKey,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleCloseModal]);

  return (
    <S.ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
      <S.ModalContainer>
        <S.ModalHeader>
          <S.ModalTitle>{modalEditing ? 'Editar Conexão IA' : 'Nova Conexão IA'}</S.ModalTitle>
          <Button variant="ghost" size="sm" onClick={handleCloseModal}>
            <RiCloseLine size={20} />
          </Button>
        </S.ModalHeader>

        <S.ModalContent>
          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-name">Nome da Conexão *</S.AILabel>
            <S.AIInput
              id="ai-name"
              value={form.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="Ex: GPT-4o Produção"
            />
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel>Provider *</S.AILabel>
            <SearchSelect
              options={PROVIDER_OPTIONS}
              value={form.provider}
              onChange={(v) => handleFormChange('provider', v)}
              placeholder="Selecione o provider..."
            />
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-apikey">API Key *</S.AILabel>
            <S.PasswordRow>
              <S.PasswordInput
                id="ai-apikey"
                type={showApiKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => handleFormChange('apiKey', e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <S.PasswordToggle type="button" onClick={handleToggleShowApiKey}>
                {showApiKey ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
              </S.PasswordToggle>
            </S.PasswordRow>
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-model">Modelo</S.AILabel>
            <S.AIInput
              id="ai-model"
              list="model-suggestions"
              value={form.model}
              onChange={(e) => handleFormChange('model', e.target.value)}
              placeholder="Ex: gpt-4o"
            />
            {modelSuggestions.length > 0 && (
              <datalist id="model-suggestions">
                {modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel>Temperatura: {parseFloat(form.temperature).toFixed(2)}</S.AILabel>
            <S.SliderRow>
              <S.Slider
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={form.temperature}
                onChange={(e) => handleFormChange('temperature', e.target.value)}
              />
              <S.SliderValue>{parseFloat(form.temperature).toFixed(2)}</S.SliderValue>
            </S.SliderRow>
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-maxtokens">Max Tokens</S.AILabel>
            <S.AIInput
              id="ai-maxtokens"
              type="number"
              min={1}
              max={200000}
              value={form.maxTokens}
              onChange={(e) => handleFormChange('maxTokens', e.target.value)}
            />
          </S.AIFormGroup>
        </S.ModalContent>

        <S.ModalActions>
          <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            $isLoading={saving}
            disabled={saving || !form.name.trim() || !form.provider}
          >
            {saving ? 'Salvando...' : modalEditing ? 'Salvar' : 'Adicionar'}
          </Button>
        </S.ModalActions>
      </S.ModalContainer>
    </S.ModalOverlay>
  );
};

export const AITabView: React.FC = () => {
  const vm = useAITabViewModel();
  const theme = useTheme();

  const getProviderMeta = (
    provider: string,
  ): { label: string; color: string; icon: React.ReactNode } => {
    const providerMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      openai: { label: 'OpenAI', color: theme.colors.aiOpenai, icon: <SiOpenai size={18} /> },
      anthropic: {
        label: 'Anthropic',
        color: theme.colors.aiAnthropic,
        icon: <RiRobot2Line size={18} />,
      },
      google: {
        label: 'Google Gemini',
        color: theme.colors.aiGoogle,
        icon: <SiGoogle size={18} />,
      },
      mistral: {
        label: 'Mistral AI',
        color: theme.colors.aiMistral,
        icon: <RiRobot2Line size={18} />,
      },
      cohere: { label: 'Cohere', color: theme.colors.aiCohere, icon: <RiRobot2Line size={18} /> },
      ollama: { label: 'Ollama', color: theme.colors.aiOllama, icon: <RiRobot2Line size={18} /> },
      other: {
        label: 'Personalizado',
        color: theme.colors.aiOther,
        icon: <RiRobot2Line size={18} />,
      },
    };
    return providerMap[provider] ?? providerMap.other;
  };

  return (
    <S.Container>
      <S.SectionTitle>Conexões IA do Escritório</S.SectionTitle>

      {vm.loading ? (
        <Spinner />
      ) : (
        <>
          {vm.error && <S.Feedback $type="error">{vm.error}</S.Feedback>}

          {vm.connections.length === 0 ? (
            <S.EmptyState>
              <RiRobot2Line size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>Nenhuma conexão IA configurada para este escritório.</p>
            </S.EmptyState>
          ) : (
            <S.AIList>
              {vm.connections.map((conn) => {
                const meta = getProviderMeta(conn.provider);
                return (
                  <AIConnectionCard
                    key={conn.id}
                    connection={conn}
                    onEdit={() => vm.handleOpenModal(conn)}
                    onDelete={() => vm.handleDelete(conn.id)}
                    onSetDefault={() => void vm.handleSetDefault(conn.id)}
                    providerColor={meta.color}
                    providerLabel={meta.label}
                    providerIcon={meta.icon}
                  />
                );
              })}
            </S.AIList>
          )}

          <S.AIAddRow>
            <Button onClick={() => vm.handleOpenModal()}>
              <RiAddLine size={16} />
              Adicionar Conexão
            </Button>
          </S.AIAddRow>
        </>
      )}

      <ConfirmModal
        isOpen={vm.confirmDelete.open}
        title="Excluir conexão IA"
        message={`Deseja remover a conexão "${vm.confirmDelete.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => void vm.runDelete()}
        onCancel={vm.cancelDelete}
      />

      {vm.showModal && (
        <AIConnectionModal
          form={vm.form}
          modalEditing={vm.modalEditing}
          saving={vm.saving}
          showApiKey={vm.showApiKey}
          modelSuggestions={vm.modelSuggestions}
          handleFormChange={vm.handleFormChange}
          handleCloseModal={vm.handleCloseModal}
          handleSave={vm.handleSave}
          handleToggleShowApiKey={vm.handleToggleShowApiKey}
        />
      )}
    </S.Container>
  );
};
