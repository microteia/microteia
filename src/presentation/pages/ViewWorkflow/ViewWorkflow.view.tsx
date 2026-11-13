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
  RiSignpostLine,
  RiRestartLine,
} from 'react-icons/ri';
import { S } from './ViewWorkflow.styles';
import { useViewWorkflowViewModel } from './ViewWorkflow.viewmodel';
import type { ViewWorkflowViewModel } from './ViewWorkflow.viewmodel';
import type { WorkflowStep } from '../../../domain/entities/Workflow';
import type { InsertTarget, BranchKey } from '../../shared/workflowHelpers';
import { SWITCH_OTHERWISE, switchPathKeyOf } from '../../shared/workflowHelpers';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { Button } from '../../components/ui/Button';
import { InputGroup, Label, Input } from '../../components/ui/Input';
import { LabelInput } from '../../components/ui/LabelInput';
import { PrefixedNameInput } from '../../components/ui/PrefixedNameInput';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { TimeInput } from '../../components/ui/TimeInput';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RunModal } from '../../components/ui/RunModal';
import { ConditionBuilder } from '../../components/ui/ConditionBuilder';
import { ConditionDiagram } from '../../components/ui/ConditionDiagram';
import { AdvancedParametersEditor } from './components/AdvancedParametersEditor';
import { PARAMETER_TYPE_OPTIONS } from './ViewWorkflow.viewmodel';
import { getStepDisplayName } from '../../shared/workflowHelpers';

import { useT, useLocaleFormat } from '../../shared/i18n/useT';

const branchKeyOf = (conditionId: string, branch: BranchKey): string => `${conditionId}:${branch}`;

const branchTarget = (conditionId: string, branch: BranchKey): InsertTarget => ({ kind: 'branch', conditionId, branch });

const loopKeyOf = (loopId: string): string => `${loopId}:body`;

const loopTarget = (loopId: string): InsertTarget => ({ kind: 'loop', loopId });

const caseTarget = (switchId: string, caseKey: string): InsertTarget => ({ kind: 'case', switchId, caseKey });

/**
 * Os caminhos de um `Switch` como a tela os desenha: cada caso, na ordem em que é avaliado, e o
 * "senão" por último. A ordem é a regra — o primeiro caso que vale é o único que roda.
 */
const switchPaths = (step: WorkflowStep): { key: string; label: string | null; steps: WorkflowStep[] }[] => [
  ...(step.switch?.cases ?? []).map((one) => ({ key: one.id, label: one.label ?? null, steps: one.steps })),
  { key: SWITCH_OTHERWISE, label: null, steps: step.switch?.otherwise ?? [] },
];

interface LevelProps {
  vm: ViewWorkflowViewModel;
  steps: WorkflowStep[];
  parentKey: string;
  target: InsertTarget;
}

const AddControls: React.FC<{ vm: ViewWorkflowViewModel; target: InsertTarget }> = ({ vm, target }) => {
  const t = useT('core.automation');

  return (
  <S.AddRow>
    <S.AddNodeBtn onClick={() => vm.openAddStep(target)} title={t('step.add')}>
      <RiAddLine size={18} />
    </S.AddNodeBtn>
    <S.AddNodeBtn onClick={() => void vm.openAddCondition(target)} title={t('condition.add')}>
      <RiGitBranchLine size={16} />
    </S.AddNodeBtn>
    <S.AddNodeBtn onClick={() => void vm.openAddLoop(target)} title={t('loop.add')}>
      <RiLoopLeftLine size={16} />
    </S.AddNodeBtn>
    <S.AddNodeBtn onClick={() => void vm.openAddSwitch(target)} title={t('switch.add')}>
      <RiSignpostLine size={16} />
    </S.AddNodeBtn>
  </S.AddRow>
  );
};

const ConnectorInsert: React.FC<{ vm: ViewWorkflowViewModel; parentKey: string; index: number; target: InsertTarget }> = ({ vm, parentKey, index, target }) => {
  const t = useT('core.automation');

  return (
  <S.ConnectorZone
    $active={vm.draggingStepId !== null && vm.dropTarget?.parentKey === parentKey && vm.dropTarget.index === index}
    onDragOver={(e) => vm.handleStepDragOverGap(e, parentKey, index)}
    onDrop={vm.handleStepDrop}
  >
    {vm.draggingStepId === null && (
      <S.ConnectorActions>
        <S.ConnectorBtn onClick={() => vm.openAddStep(target, index)} title={t('step.insert-here')}>
          <RiAddLine size={14} />
        </S.ConnectorBtn>
        <S.ConnectorBtn onClick={() => void vm.openAddCondition(target, index)} title={t('condition.insert-here')}>
          <RiGitBranchLine size={13} />
        </S.ConnectorBtn>
        <S.ConnectorBtn onClick={() => void vm.openAddLoop(target, index)} title={t('loop.insert-here')}>
          <RiLoopLeftLine size={13} />
        </S.ConnectorBtn>
        <S.ConnectorBtn onClick={() => void vm.openAddSwitch(target, index)} title={t('switch.insert-here')}>
          <RiSignpostLine size={13} />
        </S.ConnectorBtn>
      </S.ConnectorActions>
    )}
  </S.ConnectorZone>
  );
};

const StepNodeActions: React.FC<{ vm: ViewWorkflowViewModel; step: WorkflowStep }> = ({ vm, step }) => {
  const t = useT('core.automation');

  return (
  <S.NodeActions>
    <S.IconBtn title={t(step.enabled ? 'step.deactivate' : 'step.activate')} onClick={() => void vm.toggleStepEnabled(step)}>
      <S.ToggleIcon $enabled={step.enabled}>
        <RiToggleLine size={14} />
      </S.ToggleIcon>
    </S.IconBtn>
    <S.IconBtn title={t('core.ui/condition.edit')} onClick={() => vm.openEditStep(step)}>
      <RiEditLine size={14} />
    </S.IconBtn>
    <S.IconBtn title={t('core.ui/action.delete')} onClick={() => vm.handleDeleteStep(step)}>
      <RiDeleteBinLine size={14} />
    </S.IconBtn>
  </S.NodeActions>
  );
};

const FlowLevel: React.FC<LevelProps> = ({ vm, steps, parentKey, target }) => {
  const t = useT('core.automation');

  return (
  <>
    {steps.map((step, index) => {
      const definition = vm.getStepDefinition(step.stepDefinitionId);
      const StepIcon = vm.getStepIconForStep(step);
      const isCondition = step.type === 'Condition';
      const isLoop = step.type === 'Loop';
      const isSwitch = step.type === 'Switch';
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
          <S.DragHandle title={t('core.records/field.drag')}>
            <RiDraggable size={16} />
          </S.DragHandle>
          <S.StepOrder>{index + 1}</S.StepOrder>
          <S.NodeIconBox>
            <StepIcon size={18} />
          </S.NodeIconBox>
          <S.NodeBody>
            <S.NodeTitle>{getStepDisplayName(t, step, definition)}</S.NodeTitle>
            <S.NodeType>
              {isCondition
                ? vm.getConditionSummary(step)
                : isLoop
                  ? vm.getLoopSummary(step)
                  : isSwitch ? vm.getSwitchSummary(step) : vm.getStepTypeLabel(step)}
            </S.NodeType>
          </S.NodeBody>
          <S.NodeStatusDot $enabled={step.enabled} title={t(step.enabled ? 'workflow.active' : 'workflow.inactive')} />
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
                  {t(branch === 'whenTrue' ? 'condition.branch.true' : 'condition.branch.false')}
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
        {isSwitch && step.switch && (
          <S.BranchSplit>
            {switchPaths(step).map((path) => (
              <S.BranchLane
                key={path.key}
                $variant={path.key === SWITCH_OTHERWISE ? 'false' : 'true'}
                $dropActive={vm.draggingStepId !== null && vm.dropTarget?.parentKey === switchPathKeyOf(step.id, path.key)}
                onDragOver={(e) => vm.handleContainerDragOver(e, switchPathKeyOf(step.id, path.key), path.steps.length)}
                onDrop={vm.handleStepDrop}
              >
                <S.BranchLabel $variant={path.key === SWITCH_OTHERWISE ? 'false' : 'true'}>
                  {path.key === SWITCH_OTHERWISE ? t('switch.otherwise') : (path.label ?? path.key)}
                </S.BranchLabel>
                <FlowLevel
                  vm={vm}
                  steps={path.steps}
                  parentKey={switchPathKeyOf(step.id, path.key)}
                  target={caseTarget(step.id, path.key)}
                />
              </S.BranchLane>
            ))}
          </S.BranchSplit>
        )}
        {isLoop && step.loop && (
          <S.LoopBlock $dropActive={vm.draggingStepId !== null && vm.dropTarget?.parentKey === loopKeyOf(step.id)}>
            <S.LoopHeader onClick={() => vm.toggleLoopCollapsed(step.id)} title={vm.isLoopCollapsed(step.id) ? t('core.ui/condition.expand') : t('core.ui/condition.collapse')}>
              <S.LoopChevron $collapsed={vm.isLoopCollapsed(step.id)}>
                <RiArrowDownSLine size={16} />
              </S.LoopChevron>
              <S.LoopLabel>{t('loop.body')}</S.LoopLabel>
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
};

const ListLevel: React.FC<{ vm: ViewWorkflowViewModel; steps: WorkflowStep[] }> = ({ vm, steps }) => {
  const t = useT('core.automation');

  return (
  <>
    {steps.map((step, index) => {
      const definition = vm.getStepDefinition(step.stepDefinitionId);
      const StepIcon = vm.getStepIconForStep(step);
      const isCondition = step.type === 'Condition';
      const isLoop = step.type === 'Loop';
      const isSwitch = step.type === 'Switch';
      return (
        <React.Fragment key={step.id}>
          <S.StepRow $disabled={!step.enabled}>
            <S.StepOrder>{index + 1}</S.StepOrder>
            <S.StepIcon>
              <StepIcon size={18} />
            </S.StepIcon>
            <S.StepInfo>
              <S.StepName>{getStepDisplayName(t, step, definition)}</S.StepName>
              {isCondition
                ? <S.StepDescription>{vm.getConditionSummary(step)}</S.StepDescription>
                : isLoop
                  ? <S.StepDescription>{vm.getLoopSummary(step)}</S.StepDescription>
                  : isSwitch
                    ? <S.StepDescription>{vm.getSwitchSummary(step)}</S.StepDescription>
                    : definition?.description && <S.StepDescription>{definition.description}</S.StepDescription>}
            </S.StepInfo>
            <S.StepActions>
              <S.IconBtn title={t(step.enabled ? 'step.deactivate' : 'step.activate')} onClick={() => void vm.toggleStepEnabled(step)}>
                <S.ToggleIcon $enabled={step.enabled}>
                  <RiToggleLine size={14} />
                </S.ToggleIcon>
              </S.IconBtn>
              <S.IconBtn title={t('core.records/action.move-up')} disabled={index === 0} onClick={() => void vm.moveStep(step, 'up')}>
                <RiArrowUpLine size={14} />
              </S.IconBtn>
              <S.IconBtn title={t('core.records/action.move-down')} disabled={index === steps.length - 1} onClick={() => void vm.moveStep(step, 'down')}>
                <RiArrowDownLine size={14} />
              </S.IconBtn>
              <S.IconBtn title={t('core.ui/condition.edit')} onClick={() => vm.openEditStep(step)}>
                <RiEditLine size={14} />
              </S.IconBtn>
              <S.IconBtn title={t('core.ui/action.delete')} onClick={() => vm.handleDeleteStep(step)}>
                <RiDeleteBinLine size={14} />
              </S.IconBtn>
            </S.StepActions>
          </S.StepRow>
          {isCondition && step.branches && (['whenTrue', 'whenFalse'] as BranchKey[]).map((branch) => (
            <S.BranchListGroup key={branch} $variant={branch === 'whenTrue' ? 'true' : 'false'}>
              <S.BranchLabel $variant={branch === 'whenTrue' ? 'true' : 'false'}>
                {t(branch === 'whenTrue' ? 'condition.branch.true' : 'condition.branch.false')}
              </S.BranchLabel>
              <ListLevel vm={vm} steps={step.branches![branch]} />
              <AddControls vm={vm} target={branchTarget(step.id, branch)} />
            </S.BranchListGroup>
          ))}
          {isSwitch && step.switch && switchPaths(step).map((path) => (
            <S.BranchListGroup key={path.key} $variant={path.key === SWITCH_OTHERWISE ? 'false' : 'true'}>
              <S.BranchLabel $variant={path.key === SWITCH_OTHERWISE ? 'false' : 'true'}>
                {path.key === SWITCH_OTHERWISE ? t('switch.otherwise') : (path.label ?? path.key)}
              </S.BranchLabel>
              <ListLevel vm={vm} steps={path.steps} />
              <AddControls vm={vm} target={caseTarget(step.id, path.key)} />
            </S.BranchListGroup>
          ))}
          {isLoop && step.loop && (
            <S.LoopListGroup>
              <S.LoopHeader onClick={() => vm.toggleLoopCollapsed(step.id)} title={vm.isLoopCollapsed(step.id) ? t('core.ui/condition.expand') : t('core.ui/condition.collapse')}>
                <S.LoopChevron $collapsed={vm.isLoopCollapsed(step.id)}>
                  <RiArrowDownSLine size={16} />
                </S.LoopChevron>
                <S.LoopLabel>{t('loop.body')}</S.LoopLabel>
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
};

export const ViewWorkflowView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewWorkflowViewModel(tabKey);
  const t = useT('core.automation');
  const { formatDateTime } = useLocaleFormat();

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {vm.headerIcon && <vm.headerIcon size={22} />}
          <S.Title>{vm.isNew ? t('page.new-workflow') : (vm.nameOf(vm.workflow) || t('workflow.untitled'))}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          {!vm.isNew && vm.workflow && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={vm.openRunModal}
                disabled={!vm.canRunWorkflow}
                title={vm.runWorkflowDisabledReason ?? t('script.run')}
              >
                <RiPlayLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.handleCopyDeepLink} title={t('core.records/action.copy-link')}>
                {vm.copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.handleClone} title={t('core.records/action.clone')}>
                <RiFileCopyLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" title={t(vm.workflow.enabled ? 'step.deactivate' : 'step.activate')} onClick={vm.toggleEnabled}>
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
                (vm.isCalledEvent && vm.hasParameterErrors) ||
                (vm.isScheduleEvent && !!vm.scheduleError) ||
                (vm.isDateReachedEvent && !!vm.dateReachedError) ||
                !!vm.triggerStepsError
              }
              title={t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
            >
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {vm.activeTab === 'conditions' && !vm.isNew && vm.conditionChanged && (
            <S.SaveBtn
              onClick={() => void vm.handleSaveCondition()}
              disabled={vm.isSaving}
              title={t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
            >
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {!vm.isNew && vm.workflow && (
            <S.DeleteBtn onClick={vm.handleDeleteWorkflow} title={t('workflow.delete')}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'general'} onClick={() => vm.setActiveTab('general')}>{t('core.records/screen.tab.general')}</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'conditions'} onClick={() => vm.setActiveTab('conditions')}>{t('tab.conditions')}</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'steps'} onClick={() => vm.setActiveTab('steps')}>{t('tab.steps')}</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'executions'} onClick={() => vm.setActiveTab('executions')}>{t('tab.executions')}</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'versions'} onClick={() => vm.setActiveTab('versions')}>{t('tab.versions')}</S.TabBtn>
        </S.TabBar>
      )}

      {(vm.activeTab === 'general' || vm.isNew) && (
        <S.Content>
          <S.ContentInner>
            <S.Form>
              <InputGroup>
                <Label>{t('core.marketplace/author.field.name')}</Label>
                <LabelInput
                  value={vm.formData.name}
                  onChange={(name) => vm.setFormData({ name })}
                  placeholder={t('workflow.name.placeholder')}
                />
              </InputGroup>

              <InputGroup>
                <Label>{t('core.marketplace/author.field.id')}</Label>
                {vm.isNew ? (
                  <PrefixedNameInput
                    prefix={vm.artifactPrefix}
                    kind="artifact"
                    value={vm.formData.workflowId}
                    onChange={(workflowId) => vm.setFormData({ workflowId })}
                    placeholder={vm.suggestedWorkflowId || t('workflow.id.placeholder')}
                    hasError={!!vm.workflowIdError}
                  />
                ) : (
                  <Input value={vm.workflowIdValue} disabled />
                )}
                <S.FieldHint>
                  {vm.isNew
                    ? t('workflow.identifier.new')
                    : t('workflow.identifier.locked')}
                </S.FieldHint>
                {vm.workflowIdError && <S.FieldError>{vm.workflowIdError}</S.FieldError>}
              </InputGroup>

              <InputGroup>
                <Label>{t('field.description')}</Label>
                <LabelInput
                  multiline
                  value={vm.formData.description}
                  onChange={(description) => vm.setFormData({ description })}
                  rows={3}
                />
              </InputGroup>

              <InputGroup>
                <Label>{t('workflow.event')}</Label>
                {!vm.isEventNameRecognized && (
                  <InfoBanner
                    variant="warning"
                    message={t('workflow.event.missing', { event: vm.formData.eventName })}
                  />
                )}
                <SearchSelect
                  options={vm.eventNameOptions}
                  value={vm.formData.eventName}
                  onChange={(eventName) => vm.setFormData({ eventName })}
                  placeholder={t('workflow.event.placeholder')}
                />
                {vm.triggerStepsError && <S.FieldError>{vm.triggerStepsError}</S.FieldError>}
              </InputGroup>

              {vm.isLookupEvent && (
                <InputGroup>
                  <Label>{t('field.lookup')}</Label>
                  {!vm.isLookupCollectionRecognized && (
                    <InfoBanner
                      variant="warning"
                      message={t('workflow.lookup.missing')}
                    />
                  )}
                  <SearchSelect
                    options={vm.lookupCollectionOptions}
                    value={vm.formData.lookupCollection}
                    onChange={(lookupCollection) => vm.setFormData({ lookupCollection })}
                    placeholder={t('parameter.lookup.placeholder')}
                  />
                </InputGroup>
              )}

              {vm.isSavedEvent && (
                <>
                  <InputGroup>
                    <Label>{t('trigger.change.type')}</Label>
                    <SearchSelect
                      options={vm.changeTypeOptions}
                      value={vm.formData.changeType}
                      onChange={(changeType) => vm.setFormData({
                        changeType: changeType === 'created' || changeType === 'updated' ? changeType : '',
                      })}
                    />
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('trigger.change.fields')}</Label>
                    <MultiSearchSelect
                      options={vm.changedFieldOptions}
                      values={vm.formData.changedFields}
                      onChange={(changedFields) => vm.setFormData({ changedFields })}
                      placeholder={t('trigger.change.fields.any')}
                    />
                    <S.FieldHint>{t('trigger.change.fields.hint')}</S.FieldHint>
                  </InputGroup>
                </>
              )}

              {vm.isScheduleEvent && (
                <>
                  <InputGroup>
                    <Label>{t('workflow.schedule.cron')}</Label>
                    <Input
                      value={vm.formData.scheduleCron}
                      onChange={(event) => vm.setFormData({ scheduleCron: event.target.value })}
                      placeholder={t('workflow.schedule.cron.placeholder')}
                    />
                    <S.FieldHint>{t('workflow.schedule.cron.hint')}</S.FieldHint>
                    {vm.scheduleError && <S.FieldError>{vm.scheduleError}</S.FieldError>}
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('workflow.schedule.time-zone')}</Label>
                    <SearchSelect
                      options={vm.scheduleTimeZoneOptions}
                      value={vm.formData.scheduleTimeZone}
                      onChange={(scheduleTimeZone) => vm.setFormData({ scheduleTimeZone })}
                      placeholder={t('workflow.schedule.time-zone.placeholder')}
                    />
                  </InputGroup>
                  {vm.schedulePreview.length > 0 && (
                    <InputGroup>
                      <Label>{t('workflow.schedule.preview')}</Label>
                      {vm.schedulePreview.map((item) => (
                        <S.FieldHint key={item}>{item}</S.FieldHint>
                      ))}
                    </InputGroup>
                  )}
                </>
              )}

              {vm.isWebhookEvent && (
                <InputGroup>
                  <Label>{t('webhook.title')}</Label>
                  <S.FieldHint>{t('webhook.hint')}</S.FieldHint>
                  {!vm.canManageWebhook && <S.FieldHint>{t('webhook.save-first')}</S.FieldHint>}
                  {vm.issuedWebhook && (
                    <>
                      <InfoBanner message={t('webhook.token-once')} variant="warning" />
                      {vm.issuedWebhook.url && (
                        <>
                          <Label>{t('webhook.url')}</Label>
                          <Input readOnly value={vm.issuedWebhook.url} />
                        </>
                      )}
                      <Label>{t(vm.issuedWebhook.scheme === 'hmac' ? 'webhook.secret' : 'webhook.token')}</Label>
                      <Input readOnly value={vm.issuedWebhook.token} />
                      {vm.issuedWebhook.scheme === 'hmac' && (
                        <S.FieldHint>{t('webhook.hmac-hint', { header: vm.issuedWebhook.header ?? '' })}</S.FieldHint>
                      )}
                    </>
                  )}
                  {vm.canManageWebhook && (
                    <>
                      <SearchSelect
                        label={t('webhook.scheme')}
                        options={vm.webhookSchemeOptions}
                        value={vm.webhookScheme}
                        onChange={vm.setWebhookScheme}
                      />
                      {vm.webhookScheme === 'hmac' && (
                        <>
                          <Label>{t('webhook.header')}</Label>
                          <Input value={vm.webhookHeader} onChange={(event) => vm.setWebhookHeader(event.target.value)} />
                        </>
                      )}
                    </>
                  )}
                  {vm.canManageWebhook && (
                    <S.HeaderActions>
                      <Button type="button" variant="secondary" size="sm" onClick={vm.issueWebhook} disabled={vm.webhookBusy}>
                        {t('webhook.issue')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={vm.revokeWebhook} disabled={vm.webhookBusy}>
                        {t('webhook.revoke')}
                      </Button>
                    </S.HeaderActions>
                  )}
                </InputGroup>
              )}

              {vm.isDateReachedEvent && (
                <>
                  <InputGroup>
                    <Label>{t('workflow.date-reached.field')}</Label>
                    <SearchSelect
                      options={vm.dateFieldOptions}
                      value={vm.formData.dateField}
                      onChange={(dateField) => vm.setFormData({ dateField })}
                      placeholder={t('workflow.date-reached.field.placeholder')}
                    />
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('workflow.date-reached.days')}</Label>
                    <Input
                      type="number"
                      step={1}
                      value={vm.formData.dateOffsetDays}
                      onChange={(event) => vm.setFormData({ dateOffsetDays: event.target.value })}
                    />
                    <S.FieldHint>{t('workflow.date-reached.days.hint')}</S.FieldHint>
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('workflow.date-reached.at')}</Label>
                    <TimeInput value={vm.formData.dateAt} onChange={(dateAt) => vm.setFormData({ dateAt })} />
                    <S.FieldHint>{t('workflow.date-reached.hint')}</S.FieldHint>
                    {vm.dateReachedError && <S.FieldError>{vm.dateReachedError}</S.FieldError>}
                  </InputGroup>
                </>
              )}

              {vm.clockInfo && (
                <InputGroup>
                  <Label>{t('workflow.clock.title')}</Label>
                  {vm.clockInfo.warning && <InfoBanner variant="warning" message={vm.clockInfo.warning} />}
                  {vm.clockInfo.lines.map((line) => (
                    <S.FieldHint key={line}>{line}</S.FieldHint>
                  ))}
                  {vm.clockInfo.lastRunEventId && (
                    <S.ClockRunLink type="button" onClick={vm.openLastClockRun}>
                      {t('workflow.clock.open-run')}
                    </S.ClockRunLink>
                  )}
                </InputGroup>
              )}

              {vm.isCalledEvent && (
                <InputGroup>
                  <Label>{t('field.parameters')}</Label>
                  <AdvancedParametersEditor
                    parameters={vm.formData.parameters}
                    errors={vm.parameterErrors}
                    typeOptions={PARAMETER_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    entityOptions={vm.parameterEntityOptions}
                    lookupOptions={vm.parameterLookupOptions}
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
                  title={t('condition.editor')}
                >
                  <RiEditLine size={14} />
                </S.ViewToggleBtn>
                <S.ViewToggleBtn
                  $active={vm.conditionViewMode === 'diagram'}
                  onClick={() => vm.setConditionViewMode('diagram')}
                  title={t('condition.diagram')}
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
                  title={t('view.flow')}
                >
                  <RiFlowChart size={14} />
                </S.ViewToggleBtn>
                <S.ViewToggleBtn
                  $active={vm.stepsViewMode === 'list'}
                  onClick={() => vm.setStepsViewMode('list')}
                  title={t('view.list')}
                >
                  <RiListUnordered size={14} />
                </S.ViewToggleBtn>
              </S.ViewToggle>
              {vm.stepsViewMode === 'list' && (
                <Button onClick={() => vm.openAddStep()} title={t('step.add')}>
                  <RiAddLine size={14} />
                </Button>
              )}
            </S.StepsToolbar>

            {vm.stepsViewMode === 'flow' && (
              <S.FlowCanvas>
                <S.TriggerNode>
                  {vm.headerIcon && <vm.headerIcon size={18} />}
                  <S.TriggerText>
                    <S.TriggerKicker>{t('workflow.trigger')}</S.TriggerKicker>
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
                  <div>{t('step.empty')}</div>
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
              title={t(vm.stepToDelete?.type === 'Condition' ? 'condition.delete.title' : 'step.delete.title')}
              message={t(vm.stepToDelete?.type === 'Condition' ? 'condition.delete.message' : 'step.delete.message')}
              confirmLabel={t('core.ui/action.delete')}
              variant="danger"
            />
          </S.StepsContentInner>
        </S.Content>
      )}

      {vm.activeTab === 'versions' && !vm.isNew && (
        <S.Content>
          <S.ContentInner>
            {vm.versionsError && (
              <InfoBanner variant="warning" message={t('versions.load-failed', { detail: vm.versionsError })} />
            )}
            {vm.versions.length === 0 ? (
              <S.EmptyState>
                <div>{t('versions.empty')}</div>
              </S.EmptyState>
            ) : (
              <S.List>
                {vm.versions.map((version) => (
                  <S.VersionRow key={version.version}>
                    <div>
                      <S.VersionTitle>
                        {version.title}
                        {version.isCurrent && <S.VersionCurrent>{t('versions.current')}</S.VersionCurrent>}
                      </S.VersionTitle>
                      <S.FieldHint>{version.summary}</S.FieldHint>
                      <S.FieldHint>{version.origin}</S.FieldHint>
                    </div>
                    {!version.isCurrent && (
                      <S.HeaderActions>
                        <Button type="button" variant="ghost" size="sm" onClick={() => vm.toggleCompareVersion(version.version)}>
                          {t(vm.comparingVersion === version.version ? 'versions.compare.close' : 'versions.compare')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={vm.restoringVersion !== null}
                          onClick={() => vm.restoreVersion(version.version)}
                        >
                          {t('versions.restore')}
                        </Button>
                      </S.HeaderActions>
                    )}
                    {vm.comparingVersion === version.version && (
                      <S.VersionChanges>
                        {vm.versionChanges.length === 0
                          ? <S.FieldHint>{t('versions.diff.none')}</S.FieldHint>
                          : vm.versionChanges.map((change) => <S.FieldHint key={change}>{change}</S.FieldHint>)}
                      </S.VersionChanges>
                    )}
                  </S.VersionRow>
                ))}
              </S.List>
            )}
          </S.ContentInner>
        </S.Content>
      )}

      {vm.activeTab === 'executions' && !vm.isNew && (
        <S.Content>
          <S.ContentInner>
            {vm.executionsError && (
              <InfoBanner
                variant="warning"
                message={t('executions.load-failed', { detail: vm.executionsError })}
              />
            )}
            {vm.executions.length === 0 ? (
              <S.EmptyState>
                <div>{t('executions.empty')}</div>
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
                        {formatDateTime(execution.startedAt)}
                        {execution.status === 'WAITING' && execution.resumeAt && (
                          <S.FieldHint>{t('executions.waiting-until', { when: formatDateTime(execution.resumeAt) })}</S.FieldHint>
                        )}
                        {vm.canRerun && vm.isRerunnable(execution) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void vm.rerunExecution(execution)}
                            disabled={vm.rerunningId !== null}
                            title={t('executions.rerun')}
                          >
                            <RiRestartLine size={14} />
                          </Button>
                        )}
                      </S.ExecutionSummary>

                      {stepLogs.length > 0 && (
                        <S.StepProgressBar>
                          {stepLogs.map((log, i) => {
                            const status = vm.getStepLogStatus(log);
                            return <S.StepProgressDot key={i} $status={status} title={status} />;
                          })}
                          <S.StepProgressLabel>
                            {t('execution.step-progress', { done: stepLogs.filter((l) => l.level === 'SUCCESS').length, total: stepLogs.length })}
                          </S.StepProgressLabel>
                        </S.StepProgressBar>
                      )}

                      {stepLogs.map((log, i) => {
                        const step = log.stepId ? vm.getStepById(log.stepId) : undefined;
                        const definition = log.stepDefinitionId ? vm.getStepDefinition(log.stepDefinitionId) : undefined;
                        const stepName = step ? getStepDisplayName(t, step, definition) : (definition?.name || log.stepDefinitionId || 'Step');
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
                                      {vm.isLogDataExpanded(execution.id, i, 'contextInput') ? '▼' : '▶'} {t('execution.inputs', { count: Object.keys(log.contextInput).length })}
                                    </S.DataToggle>
                                    {vm.isLogDataExpanded(execution.id, i, 'contextInput') && (
                                      <S.DataJson>{JSON.stringify(log.contextInput, null, 2)}</S.DataJson>
                                    )}
                                  </S.DataSection>
                                )}

                                {log.outputs && Object.keys(log.outputs).length > 0 && (
                                  <S.DataSection>
                                    <S.DataToggle onClick={() => vm.toggleLogData(execution.id, i, 'outputs')}>
                                      {vm.isLogDataExpanded(execution.id, i, 'outputs') ? '▼' : '▶'} {t('execution.outputs', { count: Object.keys(log.outputs).length })}
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
                            {vm.isExecutionOutputsExpanded(execution.id) ? '▼' : '▶'} {t('execution.outputs.all', { count: Object.keys(execution.outputs).length })}
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
          title={t('workflow.run.title', { name: vm.nameOf(vm.workflow) || t('workflow.untitled') })}
          parameters={vm.runModalParameters}
          runLabel={t('workflow.run.action')}
          onClose={vm.closeRunModal}
          onRun={vm.runWorkflowForModal}
          onOpenExecution={vm.openRunExecution}
        />
      )}

      <ConfirmModal
        isOpen={!!vm.workflowToDelete}
        onConfirm={() => void vm.confirmDeleteWorkflow()}
        onCancel={vm.cancelDeleteWorkflow}
        title={t('workflow.delete')}
        message={t('workflow.delete.message', { name: vm.nameOf(vm.workflowToDelete) })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
