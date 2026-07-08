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
import { ConditionBuilder } from '../../components/ui/ConditionBuilder';
import { getStepDisplayName } from '../../shared/workflowHelpers';

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
          {vm.activeTab === 'conditions' && !vm.isNew && (
            <S.SaveBtn
              onClick={() => void vm.handleSaveCondition()}
              disabled={vm.isSaving || !vm.conditionChanged}
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
          {vm.workflow && (
            <ConditionBuilder
              value={vm.pendingCondition}
              onChange={vm.handleConditionLocalChange}
              eventName={vm.workflow.eventName}
              screenKey={vm.workflow.screenKey}
            />
          )}
        </S.Content>
      )}

      {vm.activeTab === 'steps' && !vm.isNew && (
        <S.Content>
          <S.StepsToolbar>
            <Button onClick={vm.openAddStep}>
              <RiAddLine size={14} />
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
                      <S.StepName>{getStepDisplayName(step, definition)}</S.StepName>
                      {definition?.description && <S.StepDescription>{definition.description}</S.StepDescription>}
                    </S.StepInfo>
                    <S.StepActions>
                      <S.IconBtn title={step.enabled ? 'Inativar' : 'Ativar'} onClick={() => void vm.toggleStepEnabled(step)}>
                        <S.ToggleIcon $enabled={step.enabled}>
                          <RiToggleLine size={14} />
                        </S.ToggleIcon>
                      </S.IconBtn>
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
              {vm.executions.map((execution) => {
                const stepLogs = execution.logs.filter((log) => log.stepId);
                const generalLogs = execution.logs.filter((log) => !log.stepId);

                return (
                  <S.ExecutionRow key={execution.id}>
                    <S.ExecutionSummary>
                      <S.StatusBadge $status={execution.status}>{execution.status}</S.StatusBadge>
                      {execution.startedAt.toLocaleString('pt-BR')}
                    </S.ExecutionSummary>

                    {stepLogs.length > 0 && (
                      <S.StepProgressBar>
                        {stepLogs.map((log, i) => {
                          const status = vm.getStepLogStatus(log);
                          return <S.StepProgressDot key={i} $status={status} title={status} />;
                        })}
                        <S.StepProgressLabel>
                          {stepLogs.filter((l) => l.level === 'SUCCESS').length}/{stepLogs.length} steps
                        </S.StepProgressLabel>
                      </S.StepProgressBar>
                    )}

                    {stepLogs.map((log, i) => {
                      const step = log.stepId ? vm.steps.find((s) => s.id === log.stepId) : undefined;
                      const definition = log.stepDefinitionId ? vm.getStepDefinition(log.stepDefinitionId) : undefined;
                      const stepName = step ? getStepDisplayName(step, definition) : (definition?.name || log.stepDefinitionId || 'Step');
                      const isExpanded = vm.isStepResultExpanded(execution.id, log.stepId || String(i));
                      const StepIcon = log.stepDefinitionId ? vm.getStepIcon(log.stepDefinitionId) : RiFlowChart;
                      const status = vm.getStepLogStatus(log);

                      return (
                        <S.StepResultCard key={i} $status={status}>
                          <S.StepResultHeader onClick={() => vm.toggleStepResult(execution.id, log.stepId || String(i))}>
                            <span>{isExpanded ? '▼' : '▶'}</span>
                            <S.StepResultIcon>
                              <StepIcon size={16} />
                            </S.StepResultIcon>
                            <span>{stepName}</span>
                            <S.StepStatusBadge $status={status}>{status}</S.StepStatusBadge>
                          </S.StepResultHeader>
                          {isExpanded && (
                            <S.StepResultBody>
                              <S.StepMessage $level={log.level}>[{log.level}] {log.message}</S.StepMessage>

                              {log.contextInput && Object.keys(log.contextInput).length > 0 && (
                                <S.DataSection>
                                  <S.DataToggle onClick={() => vm.toggleLogData(execution.id, i, 'contextInput')}>
                                    {vm.isLogDataExpanded(execution.id, i, 'contextInput') ? '▼' : '▶'} Entrada ({Object.keys(log.contextInput).length})
                                  </S.DataToggle>
                                  {vm.isLogDataExpanded(execution.id, i, 'contextInput') && (
                                    <S.DataJson>{JSON.stringify(log.contextInput, null, 2)}</S.DataJson>
                                  )}
                                </S.DataSection>
                              )}

                              {log.outputs && Object.keys(log.outputs).length > 0 && (
                                <S.DataSection>
                                  <S.DataToggle onClick={() => vm.toggleLogData(execution.id, i, 'outputs')}>
                                    {vm.isLogDataExpanded(execution.id, i, 'outputs') ? '▼' : '▶'} Saída ({Object.keys(log.outputs).length})
                                  </S.DataToggle>
                                  {vm.isLogDataExpanded(execution.id, i, 'outputs') && (
                                    <S.DataJson>{JSON.stringify(log.outputs, null, 2)}</S.DataJson>
                                  )}
                                </S.DataSection>
                              )}
                            </S.StepResultBody>
                          )}
                        </S.StepResultCard>
                      );
                    })}

                    {generalLogs.length > 0 && (
                      <S.LogList>
                        {generalLogs.map((log, i) => (
                          <S.LogEntry key={i} $level={log.level}>[{log.level}] {log.message}</S.LogEntry>
                        ))}
                      </S.LogList>
                    )}

                    {Object.keys(execution.outputs).length > 0 && (
                      <S.GeneralOutputsSection>
                        <S.OutputsToggle onClick={() => vm.toggleExecutionOutputs(execution.id)}>
                          {vm.isExecutionOutputsExpanded(execution.id) ? '▼' : '▶'} Saída geral ({Object.keys(execution.outputs).length})
                        </S.OutputsToggle>
                        {vm.isExecutionOutputsExpanded(execution.id) && (
                          <S.OutputsJson>{JSON.stringify(execution.outputs, null, 2)}</S.OutputsJson>
                        )}
                      </S.GeneralOutputsSection>
                    )}
                  </S.ExecutionRow>
                );
              })}
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
