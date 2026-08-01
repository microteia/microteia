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
  RiGitBranchLine,
  RiLoopLeftLine,
  RiArrowDownSLine,
  RiPlayLine,
} from 'react-icons/ri';
import { S } from './ViewWorkflow.styles';
import { useViewWorkflowViewModel, LOOKUP_COLLECTION_OPTIONS } from './ViewWorkflow.viewmodel';
import type { ViewWorkflowViewModel } from './ViewWorkflow.viewmodel';
import type { WorkflowStep } from '../../../domain/entities/Workflow';
import type { InsertTarget, BranchKey } from '../../shared/workflowHelpers';
import { Button } from '../../components/ui/Button';
import { InputGroup, Label, Input, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RunModal } from '../../components/ui/RunModal';
import { ConditionBuilder } from '../../components/ui/ConditionBuilder';
import { ConditionDiagram } from '../../components/ui/ConditionDiagram';
import { AdvancedParametersEditor } from './components/AdvancedParametersEditor';
import { PARAMETER_TYPE_OPTIONS } from './ViewWorkflow.viewmodel';
import { getStepDisplayName } from '../../shared/workflowHelpers';

const branchKeyOf = (conditionId: string, branch: BranchKey): string => `${conditionId}:${branch}`;

const branchTarget = (conditionId: string, branch: BranchKey): InsertTarget => ({ kind: 'branch', conditionId, branch });

const loopKeyOf = (loopId: string): string => `${loopId}:body`;

const loopTarget = (loopId: string): InsertTarget => ({ kind: 'loop', loopId });

interface LevelProps {
  vm: ViewWorkflowViewModel;
  steps: WorkflowStep[];
  parentKey: string;
  target: InsertTarget;
}

const AddControls: React.FC<{ vm: ViewWorkflowViewModel; target: InsertTarget }> = ({ vm, target }) => (
  <S.AddRow>
    <S.AddNodeBtn onClick={() => vm.openAddStep(target)} title="Adicionar step">
      <RiAddLine size={18} />
    </S.AddNodeBtn>
    <S.AddNodeBtn onClick={() => void vm.openAddCondition(target)} title="Adicionar condição">
      <RiGitBranchLine size={16} />
    </S.AddNodeBtn>
    <S.AddNodeBtn onClick={() => void vm.openAddLoop(target)} title="Adicionar repetição">
      <RiLoopLeftLine size={16} />
    </S.AddNodeBtn>
  </S.AddRow>
);

const ConnectorInsert: React.FC<{ vm: ViewWorkflowViewModel; parentKey: string; index: number; target: InsertTarget }> = ({ vm, parentKey, index, target }) => (
  <S.ConnectorZone
    $active={vm.draggingStepId !== null && vm.dropTarget?.parentKey === parentKey && vm.dropTarget.index === index}
    onDragOver={(e) => vm.handleStepDragOverGap(e, parentKey, index)}
    onDrop={vm.handleStepDrop}
  >
    {vm.draggingStepId === null && (
      <S.ConnectorActions>
        <S.ConnectorBtn onClick={() => vm.openAddStep(target, index)} title="Inserir step aqui">
          <RiAddLine size={14} />
        </S.ConnectorBtn>
        <S.ConnectorBtn onClick={() => void vm.openAddCondition(target, index)} title="Inserir condição aqui">
          <RiGitBranchLine size={13} />
        </S.ConnectorBtn>
        <S.ConnectorBtn onClick={() => void vm.openAddLoop(target, index)} title="Inserir repetição aqui">
          <RiLoopLeftLine size={13} />
        </S.ConnectorBtn>
      </S.ConnectorActions>
    )}
  </S.ConnectorZone>
);

const StepNodeActions: React.FC<{ vm: ViewWorkflowViewModel; step: WorkflowStep }> = ({ vm, step }) => (
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
);

const FlowLevel: React.FC<LevelProps> = ({ vm, steps, parentKey, target }) => (
  <>
    {steps.map((step, index) => {
      const definition = vm.getStepDefinition(step.stepDefinitionId);
      const StepIcon = vm.getStepIconForStep(step);
      const isCondition = step.type === 'Condition';
      const isLoop = step.type === 'Loop';
      return (
      <React.Fragment key={step.id}>
        <ConnectorInsert vm={vm} parentKey={parentKey} index={index} target={target} />
        <S.FlowNode
          draggable
          $disabled={!step.enabled}
          $dragging={vm.draggingStepId === step.id}
          onDragStart={(e) => vm.handleStepDragStart(e, step.id, parentKey)}
          onDragEnd={vm.handleStepDragEnd}
          onDragOver={(e) => vm.handleStepDragOverNode(e, parentKey, index)}
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
            <S.NodeType>{isCondition ? vm.getConditionSummary(step) : isLoop ? vm.getLoopSummary(step) : vm.getStepTypeLabel(step)}</S.NodeType>
          </S.NodeBody>
          <S.NodeStatusDot $enabled={step.enabled} title={step.enabled ? 'Ativo' : 'Inativo'} />
          <StepNodeActions vm={vm} step={step} />
        </S.FlowNode>
        {step.type === 'Condition' && step.branches && (
          <S.BranchSplit>
            {(['whenTrue', 'whenFalse'] as BranchKey[]).map((branch) => (
              <S.BranchLane
                key={branch}
                $variant={branch === 'whenTrue' ? 'true' : 'false'}
                $dropActive={vm.draggingStepId !== null && vm.dropTarget?.parentKey === branchKeyOf(step.id, branch)}
                onDragOver={(e) => vm.handleContainerDragOver(e, branchKeyOf(step.id, branch), step.branches![branch].length)}
                onDrop={vm.handleStepDrop}
              >
                <S.BranchLabel $variant={branch === 'whenTrue' ? 'true' : 'false'}>
                  {branch === 'whenTrue' ? 'Verdadeiro' : 'Falso'}
                </S.BranchLabel>
                <FlowLevel
                  vm={vm}
                  steps={step.branches![branch]}
                  parentKey={branchKeyOf(step.id, branch)}
                  target={branchTarget(step.id, branch)}
                />
              </S.BranchLane>
            ))}
          </S.BranchSplit>
        )}
        {isLoop && step.loop && (
          <S.LoopBlock $dropActive={vm.draggingStepId !== null && vm.dropTarget?.parentKey === loopKeyOf(step.id)}>
            <S.LoopHeader onClick={() => vm.toggleLoopCollapsed(step.id)} title={vm.isLoopCollapsed(step.id) ? 'Expandir' : 'Recolher'}>
              <S.LoopChevron $collapsed={vm.isLoopCollapsed(step.id)}>
                <RiArrowDownSLine size={16} />
              </S.LoopChevron>
              <S.LoopLabel>Corpo da repetição</S.LoopLabel>
            </S.LoopHeader>
            {!vm.isLoopCollapsed(step.id) && (
              <S.LoopBody
                onDragOver={(e) => vm.handleContainerDragOver(e, loopKeyOf(step.id), step.loop!.body.length)}
                onDrop={vm.handleStepDrop}
              >
                <FlowLevel
                  vm={vm}
                  steps={step.loop.body}
                  parentKey={loopKeyOf(step.id)}
                  target={loopTarget(step.id)}
                />
              </S.LoopBody>
            )}
          </S.LoopBlock>
        )}
      </React.Fragment>
      );
    })}
    <S.FlowConnector
      $dashed
      $active={vm.draggingStepId !== null && vm.dropTarget?.parentKey === parentKey && vm.dropTarget.index === steps.length}
      onDragOver={(e) => vm.handleStepDragOverGap(e, parentKey, steps.length)}
      onDrop={vm.handleStepDrop}
    />
    <AddControls vm={vm} target={target} />
  </>
);

const ListLevel: React.FC<{ vm: ViewWorkflowViewModel; steps: WorkflowStep[] }> = ({ vm, steps }) => (
  <>
    {steps.map((step, index) => {
      const definition = vm.getStepDefinition(step.stepDefinitionId);
      const StepIcon = vm.getStepIconForStep(step);
      const isCondition = step.type === 'Condition';
      const isLoop = step.type === 'Loop';
      return (
        <React.Fragment key={step.id}>
          <S.StepRow $disabled={!step.enabled}>
            <S.StepOrder>{index + 1}</S.StepOrder>
            <S.StepIcon>
              <StepIcon size={18} />
            </S.StepIcon>
            <S.StepInfo>
              <S.StepName>{getStepDisplayName(step, definition)}</S.StepName>
              {isCondition
                ? <S.StepDescription>{vm.getConditionSummary(step)}</S.StepDescription>
                : isLoop
                  ? <S.StepDescription>{vm.getLoopSummary(step)}</S.StepDescription>
                  : definition?.description && <S.StepDescription>{definition.description}</S.StepDescription>}
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
              <S.IconBtn title="Mover para baixo" disabled={index === steps.length - 1} onClick={() => void vm.moveStep(step, 'down')}>
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
          {isCondition && step.branches && (['whenTrue', 'whenFalse'] as BranchKey[]).map((branch) => (
            <S.BranchListGroup key={branch} $variant={branch === 'whenTrue' ? 'true' : 'false'}>
              <S.BranchLabel $variant={branch === 'whenTrue' ? 'true' : 'false'}>
                {branch === 'whenTrue' ? 'Verdadeiro' : 'Falso'}
              </S.BranchLabel>
              <ListLevel vm={vm} steps={step.branches![branch]} />
              <AddControls vm={vm} target={branchTarget(step.id, branch)} />
            </S.BranchListGroup>
          ))}
          {isLoop && step.loop && (
            <S.LoopListGroup>
              <S.LoopHeader onClick={() => vm.toggleLoopCollapsed(step.id)} title={vm.isLoopCollapsed(step.id) ? 'Expandir' : 'Recolher'}>
                <S.LoopChevron $collapsed={vm.isLoopCollapsed(step.id)}>
                  <RiArrowDownSLine size={16} />
                </S.LoopChevron>
                <S.LoopLabel>Corpo da repetição</S.LoopLabel>
              </S.LoopHeader>
              {!vm.isLoopCollapsed(step.id) && (
                <>
                  <ListLevel vm={vm} steps={step.loop.body} />
                  <AddControls vm={vm} target={loopTarget(step.id)} />
                </>
              )}
            </S.LoopListGroup>
          )}
        </React.Fragment>
      );
    })}
  </>
);

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
              <Button
                variant="ghost"
                size="sm"
                onClick={vm.openRunModal}
                disabled={!vm.canRunWorkflow}
                title={vm.runWorkflowDisabledReason ?? 'Executar (Debug)'}
              >
                <RiPlayLine size={14} />
              </Button>
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
                !!vm.workflowIdError ||
                !vm.formData.eventName ||
                (vm.isLookupEvent && !vm.formData.lookupCollection) ||
                (vm.isCalledEvent && vm.hasParameterErrors)
              }
              title={vm.isSaving ? 'Salvando...' : 'Salvar'}
            >
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {vm.activeTab === 'conditions' && !vm.isNew && vm.conditionChanged && (
            <S.SaveBtn
              onClick={() => void vm.handleSaveCondition()}
              disabled={vm.isSaving}
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
                <Label>Identificador</Label>
                <Input
                  value={vm.isNew ? vm.formData.workflowId : vm.workflowIdValue}
                  onChange={(e) => vm.setFormData({ workflowId: e.target.value })}
                  placeholder={vm.suggestedWorkflowId || 'ex: avisar-cliente'}
                  disabled={!vm.isNew}
                />
                <S.FieldHint>
                  {vm.isNew
                    ? 'É por ele que uma Ação escolhe esta automação. Em branco, criamos um a partir do nome. Não muda depois de criada.'
                    : 'O identificador não muda depois que a automação é criada — as Ações e os pacotes que apontam para ela deixariam de encontrá-la.'}
                </S.FieldHint>
                {vm.workflowIdError && <S.FieldError>{vm.workflowIdError}</S.FieldError>}
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
                  options={vm.eventNameOptions}
                  value={vm.formData.eventName}
                  onChange={(eventName) => vm.setFormData({ eventName })}
                  placeholder="Selecione um evento..."
                />
              </InputGroup>

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
                parameters={vm.workflow.parameters}
                focusPath={vm.conditionFocusPath}
                onFocusHandled={vm.clearConditionFocusPath}
              />
            )}
            {vm.workflow && vm.conditionViewMode === 'diagram' && (
              <ConditionDiagram
                condition={vm.pendingCondition}
                eventName={vm.workflow.eventName}
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
          <S.StepsContentInner>
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
                <Button onClick={() => vm.openAddStep()} title="Adicionar step">
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

                <FlowLevel vm={vm} steps={vm.steps} parentKey="root" target={{ kind: 'root' }} />
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
                  <ListLevel vm={vm} steps={vm.steps} />
                </S.List>
              )
            )}

            <ConfirmModal
              isOpen={!!vm.stepToDelete}
              onConfirm={() => void vm.confirmDeleteStep()}
              onCancel={vm.cancelDeleteStep}
              title={vm.stepToDelete?.type === 'Condition' ? 'Excluir Condição' : 'Excluir Step'}
              message={
                vm.stepToDelete?.type === 'Condition'
                  ? 'Excluir esta condição também remove todos os steps dos ramos Verdadeiro e Falso. Esta ação não pode ser desfeita.'
                  : 'Tem certeza que deseja excluir este step? Esta ação não pode ser desfeita.'
              }
              confirmLabel="Excluir"
              variant="danger"
            />
          </S.StepsContentInner>
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
                        const step = log.stepId ? vm.getStepById(log.stepId) : undefined;
                        const definition = log.stepDefinitionId ? vm.getStepDefinition(log.stepDefinitionId) : undefined;
                        const stepName = step ? getStepDisplayName(step, definition) : (definition?.name || log.stepDefinitionId || 'Step');
                        const isExpanded = vm.isStepResultExpanded(execution.id, log.stepId || String(i));
                        const StepIcon = step ? vm.getStepIconForStep(step) : (log.stepDefinitionId ? vm.getStepIcon(log.stepDefinitionId) : RiFlowChart);
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

      {vm.runModalOpen && (
        <RunModal
          title={`Executar: ${vm.workflow?.name || 'Automação'}`}
          parameters={vm.runModalParameters}
          runLabel="Executar Automação"
          onClose={vm.closeRunModal}
          onRun={vm.runWorkflowForModal}
        />
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
