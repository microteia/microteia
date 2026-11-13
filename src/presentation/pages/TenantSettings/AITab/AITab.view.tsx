import React, { useEffect, useMemo } from 'react';
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
import type { AIConnectionForm, AIFieldErrors } from './AITab.viewmodel';

import { useT, useLabel } from '../../../shared/i18n/useT';
// Nome de PRODUTO é marca: "OpenAI" e "Anthropic (Claude)" se escrevem igual em qualquer idioma.
// "Outro" saiu da lista: sem campo de endpoint e sem serviço no backend, a conexão era salva e
// toda chamada falhava como provedor não suportado.
/* eslint-disable no-restricted-syntax */
const PROVIDER_OPTIONS: SearchSelectOption[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'cohere', label: 'Cohere' },
];
/* eslint-enable no-restricted-syntax */

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
  const t = useT('core.tenant');
  return (
    <S.AICard $isDefault={connection.isDefault}>
      <S.AIProviderIcon $color={providerColor}>{providerIcon}</S.AIProviderIcon>
      <S.AICardBody>
        <S.AICardName>
          {connection.name}
          {connection.isDefault && <S.DefaultBadge>{t('ai.default')}</S.DefaultBadge>}
        </S.AICardName>
        <S.AICardMeta>
          {providerLabel} · {connection.model || t('ai.model.unset')} · {t('ai.temperature.short')}{' '}
          {connection.temperature}
        </S.AICardMeta>
      </S.AICardBody>
      <S.AICardActions>
        {!connection.isDefault && (
          <Button size="sm" variant="ghost" onClick={onSetDefault} title={t('ai.set-default')}>
            <RiStarLine size={16} />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} title={t('core.ui/action.edit')}>
          <RiEditLine size={16} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} title={t('core.ui/action.delete')}>
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
  apiKeyRequired: boolean;
  formError: string | null;
  fieldErrors: AIFieldErrors;
  modelOptions: SearchSelectOption[];
  modelIsFreeText: boolean;
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
  apiKeyRequired,
  formError,
  fieldErrors,
  modelOptions,
  modelIsFreeText,
  handleFormChange,
  handleCloseModal,
  handleSave,
  handleToggleShowApiKey,
}) => {
  const t = useT('core.tenant');
  const label = useLabel();
  const providerOptions = useMemo(
    () => PROVIDER_OPTIONS.map((option) => ({ ...option, label: label(option.label) })),
    [label],
  );

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
          <S.ModalTitle>{t(modalEditing ? 'ai.modal.edit' : 'ai.modal.new')}</S.ModalTitle>
          <Button variant="ghost" size="sm" onClick={handleCloseModal}>
            <RiCloseLine size={20} />
          </Button>
        </S.ModalHeader>

        <S.ModalContent>
          {formError && <S.Feedback $type="error">{formError}</S.Feedback>}

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-name">{t('ai.name')}</S.AILabel>
            <S.AIInput
              id="ai-name"
              value={form.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder={t('ai.name.placeholder')}
            />
            {fieldErrors.name && <S.AIFieldError>{fieldErrors.name}</S.AIFieldError>}
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel>{t('ai.provider')}</S.AILabel>
            <SearchSelect
              options={providerOptions}
              value={form.provider}
              onChange={(v) => handleFormChange('provider', v)}
              placeholder={t('ai.provider.placeholder')}
            />
            {fieldErrors.provider && <S.AIFieldError>{fieldErrors.provider}</S.AIFieldError>}
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-apikey">
              {t(apiKeyRequired ? 'ai.api-key.required' : 'ai.api-key')}
            </S.AILabel>
            <S.PasswordRow>
              <S.PasswordInput
                id="ai-apikey"
                type={showApiKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => handleFormChange('apiKey', e.target.value)}
                placeholder={t(apiKeyRequired ? 'ai.api-key.example' : 'ai.api-key.placeholder')}
                autoComplete="off"
              />
              <S.PasswordToggle type="button" onClick={handleToggleShowApiKey}>
                {showApiKey ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
              </S.PasswordToggle>
            </S.PasswordRow>
            {fieldErrors.apiKey && <S.AIFieldError>{fieldErrors.apiKey}</S.AIFieldError>}
            <S.AIFieldHint>
              {t(apiKeyRequired ? 'ai.api-key.hint.new' : 'ai.api-key.hint.existing')}
            </S.AIFieldHint>
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor={modelIsFreeText ? 'ai-model' : undefined}>{t('ai.model')}</S.AILabel>
            {modelIsFreeText ? (
              <S.AIInput
                id="ai-model"
                value={form.model}
                onChange={(e) => handleFormChange('model', e.target.value)}
                placeholder={t('ai.model.placeholder')}
              />
            ) : (
              <SearchSelect
                options={modelOptions}
                value={form.model}
                onChange={(v) => handleFormChange('model', v)}
                placeholder={t('ai.model.select')}
              />
            )}
            {fieldErrors.model && <S.AIFieldError>{fieldErrors.model}</S.AIFieldError>}
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel>
              {t('ai.temperature', { value: parseFloat(form.temperature).toFixed(2) })}
            </S.AILabel>
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
            <S.AILabel htmlFor="ai-maxtokens">{t('ai.max-tokens')}</S.AILabel>
            <S.AIInput
              id="ai-maxtokens"
              type="number"
              min={1}
              max={200000}
              value={form.maxTokens}
              onChange={(e) => handleFormChange('maxTokens', e.target.value)}
            />
            {fieldErrors.maxTokens && <S.AIFieldError>{fieldErrors.maxTokens}</S.AIFieldError>}
          </S.AIFormGroup>
        </S.ModalContent>

        <S.ModalActions>
          <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
            {t('core.ui/action.cancel')}
          </Button>
          <Button onClick={() => void handleSave()} $isLoading={saving} disabled={saving}>
            {t(saving ? 'core.ui/action.saving' : modalEditing ? 'core.ui/action.save' : 'core.ui/action.add')}
          </Button>
        </S.ModalActions>
      </S.ModalContainer>
    </S.ModalOverlay>
  );
};

export const AITabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = useAITabViewModel();
  const theme = useTheme();

  const getProviderMeta = (
    provider: string,
  ): { label: string; color: string; icon: React.ReactNode } => {
    const providerMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      /* eslint-disable no-restricted-syntax -- marca de produto: não traduz. */
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
      /* eslint-enable no-restricted-syntax */
    };
    // Conexão gravada quando ainda existiam "Outro" e "Ollama" continua listada, para poder ser excluída.
    return (
      providerMap[provider] ?? {
        label: t('ai.provider.custom'),
        color: theme.colors.aiOther,
        icon: <RiRobot2Line size={18} />,
      }
    );
  };

  return (
    <S.Container>
      <S.SectionTitle>{t('ai.section.title')}</S.SectionTitle>

      {vm.loading ? (
        <Spinner />
      ) : (
        <>
          {vm.error && <S.Feedback $type="error">{vm.error}</S.Feedback>}

          {vm.connections.length === 0 ? (
            <S.EmptyState>
              <RiRobot2Line size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>{t('ai.empty')}</p>
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
              {t('ai.add')}
            </Button>
          </S.AIAddRow>
        </>
      )}

      <ConfirmModal
        isOpen={vm.confirmDelete.open}
        title={t('ai.delete.title')}
        message={t('ai.delete.message', { name: vm.confirmDelete.name })}
        confirmLabel={t('core.ui/action.delete')}
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
          apiKeyRequired={vm.apiKeyRequired}
          formError={vm.formError}
          fieldErrors={vm.fieldErrors}
          modelOptions={vm.modelOptions}
          modelIsFreeText={vm.modelIsFreeText}
          handleFormChange={vm.handleFormChange}
          handleCloseModal={vm.handleCloseModal}
          handleSave={vm.handleSave}
          handleToggleShowApiKey={vm.handleToggleShowApiKey}
        />
      )}
    </S.Container>
  );
};
