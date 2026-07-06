import React from 'react';
import {
  RiFlowChart,
  RiAddLine,
  RiDeleteBinLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiEditLine,
  RiLinkM,
  RiCheckLine,
  RiFileCopyLine,
  RiToggleLine,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewWorkflow.styles';
import { useViewWorkflowViewModel, EVENT_NAME_OPTIONS, LOOKUP_COLLECTION_OPTIONS } from './ViewWorkflow.viewmodel';
import { Button } from '../../components/ui/Button';
import { InputGroup, Label, Input, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { StepEditorModalView } from './components/StepEditorModal/StepEditorModal.view';

export const ViewWorkflowView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewWorkflowViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {vm.headerIcon && <vm.headerIcon size={22} />}
          <S.Title>{vm.isNew ? 'Nova Automação' : (vm.workflow?.name || 'Automação')}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          {!vm.isNew && vm.workflow && (
            <>
              <Button variant="ghost" size="sm" onClick={vm.handleCopyDeepLink} title="Copiar link">
                {vm.copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.handleClone} title="Clonar">
                <RiFileCopyLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" title={vm.workflow.enabled ? 'Inativar' : 'Ativar'} onClick={vm.toggleEnabled}>
                <S.ToggleIcon $enabled={vm.workflow.enabled}>
                  <RiToggleLine size={14} />
                </S.ToggleIcon>
              </Button>
            </>
          )}
          {(vm.activeTab === 'general' || vm.isNew) && (
            <S.SaveBtn
              onClick={() => void vm.handleSaveGeneral()}
              disabled={
                vm.isSaving ||
                !vm.formData.name ||
                !vm.formData.eventName ||
                (vm.isCustomRecordEvent && !vm.formData.screenKey) ||
                (vm.isLookupEvent && !vm.formData.lookupCollection)
              }
              title={vm.isSaving ? 'Salvando...' : 'Salvar'}
            >
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {!vm.isNew && vm.workflow && (
            <S.DeleteBtn onClick={vm.handleDeleteWorkflow} title="Excluir Automação">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'general'} onClick={() => vm.setActiveTab('general')}>Geral</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'conditions'} onClick={() => vm.setActiveTab('conditions')}>Condições</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'steps'} onClick={() => vm.setActiveTab('steps')}>Steps</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'executions'} onClick={() => vm.setActiveTab('executions')}>Execuções</S.TabBtn>
        </S.TabBar>
      )}

      {(vm.activeTab === 'general' || vm.isNew) && (
        <S.Content>
          <S.Form>
            <InputGroup>
              <Label>Nome</Label>
              <Input
                value={vm.formData.name}
                onChange={(e) => vm.setFormData({ name: e.target.value })}
                placeholder="ex: Criar prazo ao salvar processo"
              />
            </InputGroup>

            <InputGroup>
              <Label>Descrição</Label>
              <Textarea
                value={vm.formData.description}
                onChange={(e) => vm.setFormData({ description: e.target.value })}
                rows={3}
              />
            </InputGroup>

            <InputGroup>
              <Label>Evento que dispara a automação</Label>
              {!vm.isEventNameRecognized && (
                <InfoBanner
                  variant="warning"
                  message={`O evento salvo ("${vm.formData.eventName}") não existe mais na lista atual. Selecione o evento novamente e salve.`}
                />
              )}
              <SearchSelect
                options={EVENT_NAME_OPTIONS}
                value={vm.formData.eventName}
                onChange={(eventName) => vm.setFormData({ eventName })}
                placeholder="Selecione um evento..."
              />
            </InputGroup>

            {vm.isCustomRecordEvent && (
              <InputGroup>
                <Label>Entidade customizada</Label>
                {!vm.isScreenKeyRecognized && (
                  <InfoBanner
                    variant="warning"
                    message="A entidade customizada salva neste gatilho não existe mais. Selecione a entidade novamente e salve."
                  />
                )}
                <SearchSelect
                  options={vm.screenOptions}
                  value={vm.formData.screenKey}
                  onChange={(screenKey) => vm.setFormData({ screenKey })}
                  placeholder="Selecione a entidade customizada..."
                />
              </InputGroup>
            )}

            {vm.isLookupEvent && (
              <InputGroup>
                <Label>Lista</Label>
                {!vm.isLookupCollectionRecognized && (
                  <InfoBanner
                    variant="warning"
                    message="A lista salva neste gatilho não existe mais. Selecione a lista novamente e salve."
                  />
                )}
                <SearchSelect
                  options={LOOKUP_COLLECTION_OPTIONS}
                  value={vm.formData.lookupCollection}
                  onChange={(lookupCollection) => vm.setFormData({ lookupCollection })}
                  placeholder="Selecione a lista..."
                />
              </InputGroup>
            )}
          </S.Form>
        </S.Content>
      )}

      {vm.activeTab === 'conditions' && !vm.isNew && (
        <S.Content>
          <InfoBanner
            variant="info"
            message="Construtor de condições completo chega em uma versão futura. Hoje toda automação é executada sempre que o evento ocorre."
          />
        </S.Content>
      )}

      {vm.activeTab === 'steps' && !vm.isNew && (
        <S.Content>
          <S.StepsToolbar>
            <Button onClick={vm.openAddStep}>
              <RiAddLine size={14} />
              Adicionar Step
            </Button>
          </S.StepsToolbar>

          {vm.steps.length === 0 ? (
            <S.EmptyState>
              <RiFlowChart size={40} style={{ opacity: 0.3 }} />
              <div>Nenhum step configurado ainda.</div>
            </S.EmptyState>
          ) : (
            <S.List>
              {vm.steps.map((step, index) => {
                const definition = vm.getStepDefinition(step.stepDefinitionId);
                const StepIcon = vm.getStepIcon(step.stepDefinitionId);
                return (
                  <S.StepRow key={step.id}>
                    <S.StepOrder>{index + 1}</S.StepOrder>
                    <S.StepIcon>
                      <StepIcon size={18} />
                    </S.StepIcon>
                    <S.StepInfo>
                      <S.StepName>{step.name || definition?.name || step.stepDefinitionId}</S.StepName>
                      {definition?.description && <S.StepDescription>{definition.description}</S.StepDescription>}
                    </S.StepInfo>
                    <S.StepActions>
                      <S.IconBtn title="Mover para cima" disabled={index === 0} onClick={() => void vm.moveStep(step, 'up')}>
                        <RiArrowUpLine size={14} />
                      </S.IconBtn>
                      <S.IconBtn title="Mover para baixo" disabled={index === vm.steps.length - 1} onClick={() => void vm.moveStep(step, 'down')}>
                        <RiArrowDownLine size={14} />
                      </S.IconBtn>
                      <S.IconBtn title="Editar" onClick={() => vm.openEditStep(step)}>
                        <RiEditLine size={14} />
                      </S.IconBtn>
                      <S.IconBtn title="Excluir" onClick={() => vm.handleDeleteStep(step)}>
                        <RiDeleteBinLine size={14} />
                      </S.IconBtn>
                    </S.StepActions>
                  </S.StepRow>
                );
              })}
            </S.List>
          )}

          <StepEditorModalView
            isOpen={vm.isStepModalOpen}
            stepCatalog={vm.stepCatalog}
            existingSteps={vm.steps}
            editingStep={vm.editingStep}
            eventFields={vm.eventFields}
            onSave={(step) => void vm.saveStep(step)}
            onClose={vm.closeStepModal}
          />

          <ConfirmModal
            isOpen={!!vm.stepToDelete}
            onConfirm={() => void vm.confirmDeleteStep()}
            onCancel={vm.cancelDeleteStep}
            title="Excluir Step"
            message="Tem certeza que deseja excluir este step? Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            variant="danger"
          />
        </S.Content>
      )}

      {vm.activeTab === 'executions' && !vm.isNew && (
        <S.Content>
          {vm.executionsError && (
            <InfoBanner
              variant="warning"
              message={`Não foi possível carregar as execuções (${vm.executionsError}). Isso costuma ser regra de segurança ou índice composto do Firestore ainda não configurado para "workflow_executions" — confira o console do navegador para o link de criação do índice, se houver.`}
            />
          )}
          {vm.executions.length === 0 ? (
            <S.EmptyState>
              <div>Nenhuma execução registrada ainda.</div>
            </S.EmptyState>
          ) : (
            <S.List>
              {vm.executions.map((execution) => (
                <S.ExecutionRow key={execution.id}>
                  <S.ExecutionSummary>
                    <S.StatusBadge $status={execution.status}>{execution.status}</S.StatusBadge>
                    {execution.startedAt.toLocaleString('pt-BR')}
                  </S.ExecutionSummary>
                  <S.LogList>
                    {execution.logs.map((log, i) => (
                      <S.LogEntry key={i}>[{log.level}] {log.message}</S.LogEntry>
                    ))}
                  </S.LogList>
                </S.ExecutionRow>
              ))}
            </S.List>
          )}
        </S.Content>
      )}

      <ConfirmModal
        isOpen={!!vm.workflowToDelete}
        onConfirm={() => void vm.confirmDeleteWorkflow()}
        onCancel={vm.cancelDeleteWorkflow}
        title="Excluir Automação"
        message={`Tem certeza que deseja excluir a automação "${vm.workflowToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
