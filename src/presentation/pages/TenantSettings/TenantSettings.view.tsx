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
import { S } from './TenantSettings.styles';
import {
  useTenantSettingsViewModel,
  TENANT_ROLE_LABELS,
} from './TenantSettings.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { AIConnection, TenantRole } from '../../../domain/entities';
import type { AIConnectionForm } from './TenantSettings.viewmodel';

const ROLES: TenantRole[] = ['admin', 'lawyer', 'secretary', 'user'];

const PROVIDER_OPTIONS: SearchSelectOption[] = [
  { value: 'openai',    label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google',    label: 'Google (Gemini)' },
  { value: 'mistral',   label: 'Mistral AI' },
  { value: 'cohere',    label: 'Cohere' },
  { value: 'ollama',    label: 'Ollama (Local)' },
  { value: 'other',     label: 'Outro' },
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
  aiForm: AIConnectionForm;
  aiModalEditing: AIConnection | null;
  aiSaving: boolean;
  showApiKey: boolean;
  modelSuggestions: string[];
  handleAIFormChange: (field: keyof AIConnectionForm, value: string) => void;
  handleCloseAIModal: () => void;
  handleSaveAIConnection: () => Promise<void>;
  handleToggleShowApiKey: () => void;
}

const AIConnectionModal: React.FC<AIModalProps> = ({
  aiForm, aiModalEditing, aiSaving, showApiKey, modelSuggestions,
  handleAIFormChange, handleCloseAIModal, handleSaveAIConnection, handleToggleShowApiKey,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); handleCloseAIModal(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleCloseAIModal]);

  return (
    <S.ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseAIModal()}>
      <S.ModalContainer>
        <S.ModalHeader>
          <S.ModalTitle>
            {aiModalEditing ? 'Editar Conexão IA' : 'Nova Conexão IA'}
          </S.ModalTitle>
          <Button variant="ghost" size="sm" onClick={handleCloseAIModal}>
            <RiCloseLine size={20} />
          </Button>
        </S.ModalHeader>

        <S.ModalContent>
          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-name">Nome da Conexão *</S.AILabel>
            <S.AIInput
              id="ai-name"
              value={aiForm.name}
              onChange={(e) => handleAIFormChange('name', e.target.value)}
              placeholder="Ex: GPT-4o Produção"
            />
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel>Provider *</S.AILabel>
            <SearchSelect
              options={PROVIDER_OPTIONS}
              value={aiForm.provider}
              onChange={(v) => handleAIFormChange('provider', v)}
              placeholder="Selecione o provider..."
            />
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-apikey">API Key *</S.AILabel>
            <S.PasswordRow>
              <S.PasswordInput
                id="ai-apikey"
                type={showApiKey ? 'text' : 'password'}
                value={aiForm.apiKey}
                onChange={(e) => handleAIFormChange('apiKey', e.target.value)}
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
              value={aiForm.model}
              onChange={(e) => handleAIFormChange('model', e.target.value)}
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
            <S.AILabel>Temperatura: {parseFloat(aiForm.temperature).toFixed(2)}</S.AILabel>
            <S.SliderRow>
              <S.Slider
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={aiForm.temperature}
                onChange={(e) => handleAIFormChange('temperature', e.target.value)}
              />
              <S.SliderValue>{parseFloat(aiForm.temperature).toFixed(2)}</S.SliderValue>
            </S.SliderRow>
          </S.AIFormGroup>

          <S.AIFormGroup>
            <S.AILabel htmlFor="ai-maxtokens">Max Tokens</S.AILabel>
            <S.AIInput
              id="ai-maxtokens"
              type="number"
              min={1}
              max={200000}
              value={aiForm.maxTokens}
              onChange={(e) => handleAIFormChange('maxTokens', e.target.value)}
            />
          </S.AIFormGroup>
        </S.ModalContent>

        <S.ModalActions>
          <Button variant="secondary" onClick={handleCloseAIModal} disabled={aiSaving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSaveAIConnection()}
            $isLoading={aiSaving}
            disabled={aiSaving || !aiForm.name.trim() || !aiForm.provider}
          >
            {aiSaving ? 'Salvando...' : aiModalEditing ? 'Salvar' : 'Adicionar'}
          </Button>
        </S.ModalActions>
      </S.ModalContainer>
    </S.ModalOverlay>
  );
};

export const TenantSettingsView: React.FC<{ tabKey?: string }> = ({ tabKey }) => {
  const initialTab = tabKey === 'tenant-settings:ai' ? 'ai' : tabKey === 'tenant-settings:members' ? 'members' : 'office';
  const vm = useTenantSettingsViewModel(initialTab);
  const theme = useTheme();

  const roleColors: Record<TenantRole, string> = {
    admin: theme.colors.danger,
    lawyer: theme.colors.info,
    secretary: theme.colors.primary,
    user: theme.colors.textSecondary,
  };

  const roleOptions: SearchSelectOption[] = ROLES.map((r) => ({
    value: r,
    label: TENANT_ROLE_LABELS[r],
    color: roleColors[r],
  }));

  const getProviderMeta = (provider: string): { label: string; color: string; icon: React.ReactNode } => {
    const providerMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      openai:    { label: 'OpenAI',        color: theme.colors.aiOpenai,    icon: <SiOpenai size={18} /> },
      anthropic: { label: 'Anthropic',     color: theme.colors.aiAnthropic, icon: <RiRobot2Line size={18} /> },
      google:    { label: 'Google Gemini', color: theme.colors.aiGoogle,    icon: <SiGoogle size={18} /> },
      mistral:   { label: 'Mistral AI',    color: theme.colors.aiMistral,   icon: <RiRobot2Line size={18} /> },
      cohere:    { label: 'Cohere',        color: theme.colors.aiCohere,    icon: <RiRobot2Line size={18} /> },
      ollama:    { label: 'Ollama',        color: theme.colors.aiOllama,    icon: <RiRobot2Line size={18} /> },
      other:     { label: 'Personalizado', color: theme.colors.aiOther,     icon: <RiRobot2Line size={18} /> },
    };
    return providerMap[provider] ?? providerMap.other;
  };

  return (
    <S.Page>
      <S.Header>
        <S.Title>Configurações do Escritório</S.Title>
      </S.Header>

      <S.TabsBar>
        <S.Tab $active={vm.activeTab === 'office'} onClick={() => vm.setActiveTab('office')}>
          Dados do Escritório
        </S.Tab>
        {vm.isAdmin && (
          <S.Tab $active={vm.activeTab === 'members'} onClick={() => vm.setActiveTab('members')}>
            Membros
          </S.Tab>
        )}
        {vm.isAdmin && (
          <S.Tab $active={vm.activeTab === 'ai'} onClick={() => vm.setActiveTab('ai')}>
            Conexão IA
          </S.Tab>
        )}
      </S.TabsBar>

      <S.Content>
        {vm.activeTab === 'office' && (
          <S.Section>
            <S.SectionBody>
              {!vm.isAdmin && (
                <InfoBanner
                  message="Somente administradores podem alterar os dados do escritório."
                  variant="info"
                />
              )}
              <S.FormGrid>
                <S.FormGroup $fullWidth>
                  <Label>Nome do Escritório *</Label>
                  <Input
                    value={vm.officeForm.name}
                    onChange={(e) => vm.setOfficeForm({ name: e.target.value })}
                    placeholder="Ex: Escritório de Advocacia Silva & Associados"
                    disabled={!vm.isAdmin}
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>CNPJ</Label>
                  <Input
                    value={vm.officeForm.cnpj}
                    onChange={(e) => vm.setOfficeForm({ cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    disabled={!vm.isAdmin}
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>E-mail do Escritório</Label>
                  <Input
                    type="email"
                    value={vm.officeForm.email}
                    onChange={(e) => vm.setOfficeForm({ email: e.target.value })}
                    placeholder="contato@escritorio.com"
                    disabled={!vm.isAdmin}
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>Telefone</Label>
                  <Input
                    value={vm.officeForm.phone}
                    onChange={(e) => vm.setOfficeForm({ phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    disabled={!vm.isAdmin}
                  />
                </S.FormGroup>
                <S.FormGroup $fullWidth>
                  <Label>Endereço</Label>
                  <Input
                    value={vm.officeForm.address}
                    onChange={(e) => vm.setOfficeForm({ address: e.target.value })}
                    placeholder="Rua, número, complemento, cidade - Estado"
                    disabled={!vm.isAdmin}
                  />
                </S.FormGroup>
              </S.FormGrid>
              {vm.isAdmin && (
                <S.SaveRow>
                  <Button onClick={() => void vm.handleSaveOffice()} disabled={vm.isSavingOffice}>
                    {vm.isSavingOffice ? 'Salvando...' : 'Salvar'}
                  </Button>
                </S.SaveRow>
              )}
            </S.SectionBody>
          </S.Section>
        )}

        {vm.activeTab === 'members' && vm.isAdmin && (
          <S.Section>
            <S.AddMemberRow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Label>E-mail do novo membro</Label>
                <Input
                  type="email"
                  value={vm.addEmail}
                  onChange={(e) => vm.setAddEmail(e.target.value)}
                  placeholder="email@usuario.com"
                  onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleAddMember(); }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Label>Perfil</Label>
                <SearchSelect
                  options={roleOptions}
                  value={vm.addRole}
                  onChange={(val) => { if (val) vm.setAddRole(val as TenantRole); }}
                  placeholder="Perfil..."
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button onClick={() => void vm.handleAddMember()} disabled={vm.isAddingMember}>
                  {vm.isAddingMember ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </S.AddMemberRow>

            {vm.isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Spinner />
              </div>
            ) : (
              <S.MemberList>
                {vm.members.map((member) => {
                  const isOwner = member.userId === vm.tenantOwnerId;
                  const isCurrentUser = member.userId === vm.currentUserId;
                  return (
                    <S.MemberRow key={member.userId}>
                      <S.Avatar>
                        {member.photoURL ? (
                          <img src={member.photoURL} alt={member.displayName} referrerPolicy="no-referrer" />
                        ) : (
                          member.displayName.charAt(0).toUpperCase()
                        )}
                      </S.Avatar>
                      <S.MemberInfo>
                        <S.MemberName>
                          {member.displayName}
                          {isCurrentUser && ' (você)'}
                        </S.MemberName>
                        <S.MemberEmail>{member.email}</S.MemberEmail>
                      </S.MemberInfo>
                      <S.MemberActions>
                        {isOwner || isCurrentUser ? (
                          <Badge color={roleColors[member.role]}>
                            {TENANT_ROLE_LABELS[member.role]}
                          </Badge>
                        ) : (
                          <>
                            <SearchSelect
                              options={roleOptions}
                              value={member.role}
                              onChange={(val) => { if (val) void vm.handleRoleChange(member, val as TenantRole); }}
                              placeholder="Perfil..."
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => vm.handleRemoveMember(member)}
                            >
                              <RiDeleteBinLine size={14} />
                            </Button>
                          </>
                        )}
                      </S.MemberActions>
                    </S.MemberRow>
                  );
                })}
              </S.MemberList>
            )}
          </S.Section>
        )}

        {vm.activeTab === 'ai' && vm.isAdmin && (
          <S.Section>
            <S.SectionBody>
              <S.SectionTitle>Conexões IA do Escritório</S.SectionTitle>

              {vm.aiLoading ? (
                <Spinner />
              ) : (
                <>
                  {vm.aiError && (
                    <S.Feedback $type="error" style={{ marginBottom: 12 }}>{vm.aiError}</S.Feedback>
                  )}

                  {vm.aiConnections.length === 0 ? (
                    <S.EmptyState>
                      <RiRobot2Line size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <p>Nenhuma conexão IA configurada para este escritório.</p>
                    </S.EmptyState>
                  ) : (
                    <S.AIList>
                      {vm.aiConnections.map((conn) => {
                        const meta = getProviderMeta(conn.provider);
                        return (
                          <AIConnectionCard
                            key={conn.id}
                            connection={conn}
                            onEdit={() => vm.handleOpenAIModal(conn)}
                            onDelete={() => vm.handleDeleteAIConnection(conn.id)}
                            onSetDefault={() => void vm.handleSetDefaultAIConnection(conn.id)}
                            providerColor={meta.color}
                            providerLabel={meta.label}
                            providerIcon={meta.icon}
                          />
                        );
                      })}
                    </S.AIList>
                  )}

                  <S.AIAddRow>
                    <Button onClick={() => vm.handleOpenAIModal()}>
                      <RiAddLine size={16} />
                      Adicionar Conexão
                    </Button>
                  </S.AIAddRow>
                </>
              )}
            </S.SectionBody>
          </S.Section>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.memberToRemove}
        onConfirm={() => void vm.confirmRemoveMember()}
        onCancel={vm.cancelRemoveMember}
        title="Remover Membro"
        message={`Tem certeza que deseja remover "${vm.memberToRemove?.displayName}" do escritório?`}
        confirmLabel="Remover"
        variant="danger"
      />

      <ConfirmModal
        isOpen={vm.confirmAIDelete.open}
        title="Excluir conexão IA"
        message={`Deseja remover a conexão "${vm.confirmAIDelete.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => void vm.runDeleteAI()}
        onCancel={vm.cancelDeleteAI}
      />

      {vm.showAIModal && (
        <AIConnectionModal
          aiForm={vm.aiForm}
          aiModalEditing={vm.aiModalEditing}
          aiSaving={vm.aiSaving}
          showApiKey={vm.showApiKey}
          modelSuggestions={vm.modelSuggestions}
          handleAIFormChange={vm.handleAIFormChange}
          handleCloseAIModal={vm.handleCloseAIModal}
          handleSaveAIConnection={vm.handleSaveAIConnection}
          handleToggleShowApiKey={vm.handleToggleShowApiKey}
        />
      )}
    </S.Page>
  );
};
