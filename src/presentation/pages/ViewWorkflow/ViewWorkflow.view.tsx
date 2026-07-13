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
  RiListUnordered,
  RiDraggable,
  RiNodeTree,
} from 'react-icons/ri';
import { S } from './ViewWorkflow.styles';
import { useViewWorkflowViewModel, EVENT_NAME_OPTIONS, LOOKUP_COLLECTION_OPTIONS } from './ViewWorkflow.viewmodel';
import { Button } from '../../components/ui/Button';
import { InputGroup, Label, Input, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { Checkbox } from '../../components/ui/Checkbox';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ConditionBuilder } from '../../components/ui/ConditionBuilder';
import { ConditionDiagram } from '../../components/ui/ConditionDiagram';
import { AdvancedParametersEditor } from './components/AdvancedParametersEditor';
import { PARAMETER_TYPE_OPTIONS } from './ViewWorkflow.viewmodel';
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
              {vm.workflow.sourceWorkflowId && (
                <>
                  <S.CopyBadge
                    $outdated={vm.isOutdated}
                    title={vm.isOutdated
                      ? `Versão original: ${vm.sourceWorkflowVersion} | Sua versão: ${vm.workflow.sourceVersion}`
                      : `Cópia de workflow público (versão ${vm.workflow.sourceVersion})`
                    }
                  >
                    {vm.isOutdated ? 'Desatualizado' : 'Cópia'}
                  </S.CopyBadge>
                  {vm.isOutdated && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void vm.handleUpdateFromSource()}
                      disabled={vm.isUpdating}
                      title="Atualizar do workflow original"
                    >
                      {vm.isUpdating ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                  )}
                </>
              )}
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
                (vm.isLookupEvent && !vm.formData.lookupCollection) ||
                (vm.isCalledEvent && vm.hasParameterErrors)
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
          <S.ContentInner>
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
                <Label>Versão</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={vm.formData.version}
                  onChange={(e) => vm.setFormData({ version: Number(e.target.value) || 1 })}
                />
              </InputGroup>

              <InputGroup>
                <Checkbox
                  checked={vm.formData.isPublic}
                  onChange={(checked) => vm.setFormData({ isPublic: checked })}
                  label="Workflow Público"
                />
                <InfoBanner
                  variant="info"
                  message="Workflows públicos podem ser copiados por outros escritórios, mas apenas você pode editá-los."
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

              {vm.isCalledEvent && (
                <InputGroup>
                  <Label>Parâmetros</Label>
                  <AdvancedParametersEditor
                    parameters={vm.formData.parameters}
                    errors={vm.parameterErrors}
                    typeOptions={PARAMETER_TYPE_OPTIONS}
                    entityOptions={vm.parameterEntityOptions}
                    onAdd={vm.addParameter}
                    onUpdate={vm.updateParameter}
                    onRemove={vm.removeParameter}
                    onClone={vm.cloneParameter}
                    onReplace={vm.replaceParameters}
                  />
                </InputGroup>
              )}
            </S.Form>
          </S.ContentInner>
        </S.Content>
      )}

      {vm.activeTab === 'conditions' && !vm.isNew && (
        <S.Content>
          <S.ContentInner>
            <S.StepsToolbar>
              <S.ViewToggle>
                <S.ViewToggleBtn
                  $active={vm.conditionViewMode === 'editor'}
                  onClick={() => vm.setConditionViewMode('editor')}
                  title="Editor de condições"
                >
                  <RiEditLine size={14} />
                </S.ViewToggleBtn>
                <S.ViewToggleBtn
                  $active={vm.conditionViewMode === 'diagram'}
                  onClick={() => vm.setConditionViewMode('diagram')}
                  title="Diagrama lógico"
                >
                  <RiNodeTree size={14} />
                </S.ViewToggleBtn>
              </S.ViewToggle>
            </S.StepsToolbar>
            {vm.workflow && vm.conditionViewMode === 'editor' && (
              <ConditionBuilder
                value={vm.pendingCondition}
                onChange={vm.handleConditionLocalChange}
                eventName={vm.workflow.eventName}
                screenKey={vm.workflow.screenKey}
                parameters={vm.workflow.parameters}
                focusPath={vm.conditionFocusPath}
                onFocusHandled={vm.clearConditionFocusPath}
              />
            )}
            {vm.workflow && vm.conditionViewMode === 'diagram' && (
              <ConditionDiagram
                condition={vm.pendingCondition}
                eventName={vm.workflow.eventName}
                screenKey={vm.workflow.screenKey}
                parameters={vm.workflow.parameters}
                onChange={vm.handleConditionLocalChange}
                onRequestEdit={vm.handleRequestConditionEdit}
              />
            )}
          </S.ContentInner>
        </S.Content>
      )}

      {vm.activeTab === 'steps' && !vm.isNew && (
        <S.Content>
          <S.ContentInner>
            <S.StepsToolbar>
              <S.ViewToggle>
                <S.ViewToggleBtn
                  $active={vm.stepsViewMode === 'flow'}
                  onClick={() => vm.setStepsViewMode('flow')}
                  title="Visualização em fluxo"
                >
                  <RiFlowChart size={14} />
                </S.ViewToggleBtn>
                <S.ViewToggleBtn
                  $active={vm.stepsViewMode === 'list'}
                  onClick={() => vm.setStepsViewMode('list')}
                  title="Visualização em lista"
                >
                  <RiListUnordered size={14} />
                </S.ViewToggleBtn>
              </S.ViewToggle>
              {vm.stepsViewMode === 'list' && (
                <Button onClick={vm.openAddStep} title="Adicionar step">
                  <RiAddLine size={14} />
                </Button>
              )}
            </S.StepsToolbar>

            {vm.stepsViewMode === 'flow' && (
              <S.FlowCanvas>
                <S.TriggerNode>
                  {vm.headerIcon && <vm.headerIcon size={18} />}
                  <S.TriggerText>
                    <S.TriggerKicker>Gatilho</S.TriggerKicker>
                    <S.TriggerLabel>{vm.eventLabel}</S.TriggerLabel>
                  </S.TriggerText>
                </S.TriggerNode>

                {vm.steps.map((step, index) => {
                  const definition = vm.getStepDefinition(step.stepDefinitionId);
                  const StepIcon = vm.getStepIcon(step.stepDefinitionId);
                  return (
                    <React.Fragment key={step.id}>
                      <S.FlowConnector
                        $active={vm.draggingStepId !== null && vm.dropTargetIndex === index}
                        onDragOver={(e) => vm.handleStepDragOverGap(e, index)}
                        onDrop={vm.handleStepDrop}
                      />
                      <S.FlowNode
                        draggable
                        $disabled={!step.enabled}
                        $dragging={vm.draggingStepId === step.id}
                        onDragStart={(e) => vm.handleStepDragStart(e, step.id)}
                        onDragEnd={vm.handleStepDragEnd}
                        onDragOver={(e) => vm.handleStepDragOverNode(e, index)}
                        onDrop={vm.handleStepDrop}
                      >
                        <S.DragHandle title="Arraste para reordenar">
                          <RiDraggable size={16} />
                        </S.DragHandle>
                        <S.StepOrder>{index + 1}</S.StepOrder>
                        <S.NodeIconBox>
                          <StepIcon size={18} />
                        </S.NodeIconBox>
                        <S.NodeBody>
                          <S.NodeTitle>{getStepDisplayName(step, definition)}</S.NodeTitle>
                          <S.NodeType>{vm.getStepTypeLabel(step)}</S.NodeType>
                        </S.NodeBody>
                        <S.NodeStatusDot $enabled={step.enabled} title={step.enabled ? 'Ativo' : 'Inativo'} />
                        <S.NodeActions>
                          <S.IconBtn title={step.enabled ? 'Inativar' : 'Ativar'} onClick={() => void vm.toggleStepEnabled(step)}>
                            <S.ToggleIcon $enabled={step.enabled}>
                              <RiToggleLine size={14} />
                            </S.ToggleIcon>
                          </S.IconBtn>
                          <S.IconBtn title="Editar" onClick={() => vm.openEditStep(step)}>
                            <RiEditLine size={14} />
                          </S.IconBtn>
                          <S.IconBtn title="Excluir" onClick={() => vm.handleDeleteStep(step)}>
                            <RiDeleteBinLine size={14} />
                          </S.IconBtn>
                        </S.NodeActions>
                      </S.FlowNode>
                    </React.Fragment>
                  );
                })}

                <S.FlowConnector
                  $dashed
                  $active={vm.draggingStepId !== null && vm.dropTargetIndex === vm.steps.length}
                  onDragOver={(e) => vm.handleStepDragOverGap(e, vm.steps.length)}
                  onDrop={vm.handleStepDrop}
                />
                <S.AddNodeBtn
                  onClick={vm.openAddStep}
                  title="Adicionar step"
                  onDragOver={(e) => vm.handleStepDragOverGap(e, vm.steps.length)}
                  onDrop={vm.handleStepDrop}
                >
                  <RiAddLine size={18} />
                </S.AddNodeBtn>
              </S.FlowCanvas>
            )}

            {vm.stepsViewMode === 'list' && (
              vm.steps.length === 0 ? (
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
              )
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
          </S.ContentInner>
        </S.Content>
      )}

      {vm.activeTab === 'executions' && !vm.isNew && (
        <S.Content>
          <S.ContentInner>
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
          </S.ContentInner>
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
