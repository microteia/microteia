import React from 'react';
import { RiSaveLine, RiDeleteBinLine, RiEditLine, RiNodeTree } from 'react-icons/ri';
import { InputGroup, Label, Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { Checkbox } from '../../components/ui/Checkbox';
import { DateInput } from '../../components/ui/DateInput';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { ConditionBuilder } from '../../components/ui/ConditionBuilder';
import { ConditionDiagram } from '../../components/ui/ConditionDiagram';
import { LiteralOptionsControl } from '../../components/ui/LiteralOptionsControl';
import { EntityReferenceControl } from '../../components/ui/EntityReferenceControl';
import { QueryBuilderControl } from '../ViewWorkflow/components/QueryBuilderControl';
import { UpsertBuilderControl } from '../ViewWorkflow/components/UpsertBuilderControl';
import { RemoveBuilderControl } from '../ViewWorkflow/components/RemoveBuilderControl';
import { MapBuilderControl } from '../ViewWorkflow/components/MapBuilderControl';
import { ValidateBuilderControl } from '../ViewWorkflow/components/ValidateBuilderControl';
import { S } from './EditWorkflowStep.styles';
import { useEditWorkflowStepViewModel } from './EditWorkflowStep.viewmodel';
import type { InputDefinition, InputPickerKind } from '../../../domain/entities/WorkflowStepCatalog';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { RemoveStepConfig, UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import { applyFormat, checkValue, toEffectiveRules } from '../../../domain/schema/fieldRules';
import { useT, useLabel, type TranslateFn } from '../../shared/i18n/useT';

const MAPPING_KIND_KEYS = [
  { value: 'Literal', labelKey: 'mapping.kind.literal' },
  { value: 'Event', labelKey: 'mapping.kind.event' },
  { value: 'Expression', labelKey: 'mapping.kind.expression' },
  { value: 'Output', labelKey: 'mapping.kind.output' },
  { value: 'Variable', labelKey: 'mapping.kind.variable' },
];

const getMappingKindOptions = (input: InputDefinition, t: TranslateFn) =>
  MAPPING_KIND_KEYS.filter(
    (option) =>
      !input.allowedMappingKinds
      || input.allowedMappingKinds.length === 0
      || input.allowedMappingKinds.includes(option.value as InputMapping['kind']),
  ).map((option) => ({ value: option.value, label: t(option.labelKey) }));

// Input sintético para a origem da lista de um nó Loop: reusa os mesmos controles de mapeamento
// dos demais inputs, gravando/lendo em configuration['source'].
const LOOP_SOURCE_INPUT: InputDefinition = {
  id: 'source',
  label: '@core.automation/loop.source',
  type: 'String',
  required: true,
  allowedMappingKinds: ['Output', 'Event', 'Expression', 'Variable'],
};

const literalRuleError = (
  value: string,
  input: InputDefinition,
  resolve: (message: string, params?: Record<string, string>) => string,
): string | undefined => {
  const rules = toEffectiveRules(input);
  if (!rules) return undefined;
  const issue = checkValue(applyFormat(value, rules.format), rules.validate, input.label);
  return issue ? resolve(issue.error, issue.errorParams) : undefined;
};

export const EditWorkflowStepView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const t = useT('core.automation');
  const label = useLabel();
  const vm = useEditWorkflowStepViewModel(tabKey);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const deleteTitleKey = vm.isConditionStep
    ? 'step.delete.condition'
    : vm.isLoopStep
      ? 'step.delete.loop'
      : 'step.delete.step';

  const renderLiteralControl = (input: InputDefinition, mapping: Extract<InputMapping, { kind: 'Literal' }>) => {
    if (input.options) {
      return (
        <LiteralOptionsControl
          input={input}
          value={String(mapping.value ?? '')}
          onChange={(v) => vm.setMapping(input.id, { kind: 'Literal', value: v })}
        />
      );
    }
    if (input.type === 'EntityReference') {
      return (
        <EntityReferenceControl
          input={input}
          value={String(mapping.value ?? '')}
          onChange={(v) => vm.setMapping(input.id, { kind: 'Literal', value: v })}
        />
      );
    }
    if (input.type === 'Date') {
      return <DateInput value={String(mapping.value ?? '')} onChange={(v) => vm.setMapping(input.id, { kind: 'Literal', value: v })} />;
    }
    if (input.type === 'Boolean') {
      return (
        <SearchSelect
          options={[
            { value: 'true', label: t('core.ui/answer.yes') },
            { value: 'false', label: t('core.ui/answer.no') },
          ]}
          value={String(mapping.value ?? '')}
          onChange={(v) => vm.setMapping(input.id, { kind: 'Literal', value: v === 'true' })}
          placeholder={t('core.ui/action.select')}
        />
      );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      vm.setMapping(input.id, { kind: 'Literal', value: newValue });

      const ruleError = newValue ? literalRuleError(newValue, input, label) : undefined;
      setValidationErrors(prev => {
        const next = { ...prev };
        if (ruleError) next[input.id] = ruleError;
        else delete next[input.id];
        return next;
      });
    };

    return (
      <>
        <Input
          type={input.type === 'Number' ? 'number' : 'text'}
          value={String(mapping.value ?? '')}
          onChange={handleChange}
          placeholder={input.description}
        />
        {validationErrors[input.id] && (
          <S.HelpText style={{ color: 'var(--color-danger)' }}>
            {validationErrors[input.id]}
          </S.HelpText>
        )}
      </>
    );
  };

  const renderQueryControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    const spec =
      mapping?.kind === 'Literal' && mapping.value && typeof mapping.value === 'object'
        ? (mapping.value as QuerySpec)
        : undefined;
    return (
      <QueryBuilderControl
        value={spec}
        onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
        eventFields={vm.eventFields}
        pathRoot={vm.pathRoot}
        inputRoot={vm.inputRoot}
        stepOutputFields={vm.stepOutputFields}
        workflowVariables={vm.workflowVariables}
      />
    );
  };

  const renderUpsertControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    const config =
      mapping?.kind === 'Literal' && mapping.value && typeof mapping.value === 'object'
        ? (mapping.value as UpsertStepConfig)
        : undefined;
    return (
      <UpsertBuilderControl
        value={config}
        onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
      />
    );
  };

  const renderValidateControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    const config =
      mapping?.kind === 'Literal' && mapping.value && typeof mapping.value === 'object'
        ? (mapping.value as ValidateStepConfig)
        : undefined;
    return (
      <ValidateBuilderControl
        value={config}
        onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
      />
    );
  };

  const renderMapControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    const config =
      mapping?.kind === 'Literal' && mapping.value && typeof mapping.value === 'object'
        ? (mapping.value as MapStepConfig)
        : undefined;
    return (
      <MapBuilderControl
        value={config}
        onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
        eventFields={vm.eventFields}
        pathRoot={vm.pathRoot}
        inputRoot={vm.inputRoot}
        stepOutputFields={vm.stepOutputFields}
        workflowVariables={vm.workflowVariables}
        priorStepOptions={vm.priorStepOptions}
        getStepOutputs={vm.getStepOutputs}
      />
    );
  };

  const renderRemoveControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    const config =
      mapping?.kind === 'Literal' && mapping.value && typeof mapping.value === 'object'
        ? (mapping.value as RemoveStepConfig)
        : undefined;
    return (
      <RemoveBuilderControl
        value={config}
        onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
        eventFields={vm.eventFields}
        pathRoot={vm.pathRoot}
        inputRoot={vm.inputRoot}
        stepOutputFields={vm.stepOutputFields}
        workflowVariables={vm.workflowVariables}
      />
    );
  };

  /**
   * A lista do que o input NOMEIA — automação, script ou conexão de IA. Só faz sentido com o valor
   * em `Literal`: quem o declara é o catálogo (`InputDefinition.picker`), e é o ViewModel que decide
   * quando ela cabe.
   */
  const renderPicker = (input: InputDefinition, kind: InputPickerKind) => {
    const mapping = vm.configuration[input.id];
    const stored =
      mapping?.kind === 'Literal'
        ? String((mapping as Extract<InputMapping, { kind: 'Literal' }>).value ?? '')
        : '';
    // O gravado pode ser a referência qualificada a um artefato de outra extensão; a lista é de ids
    // locais. Quem faz a ponte é o ViewModel — a View só desenha o que ele resolveu.
    const value = vm.pickerValue(kind, stored);
    return (
      <SearchSelect
        options={vm.pickerOptions(kind, value)}
        value={value}
        onChange={(chosen) => vm.setPickerValue(input.id, chosen)}
        placeholder={vm.pickerPlaceholder(kind)}
      />
    );
  };

  const renderMappingControl = (input: InputDefinition) => {
    const mapping = vm.configuration[input.id];
    if (!mapping) return null;

    switch (mapping.kind) {
      case 'Literal':
        return renderLiteralControl(input, mapping);
      case 'Event':
        return vm.eventFields.length > 0 ? (
          <SearchSelect
            options={vm.eventFields.map((f) => ({ value: f.path, label: f.label }))}
            value={mapping.path}
            onChange={(path) => vm.setMapping(input.id, { kind: 'Event', path })}
            placeholder={t('mapping.event.placeholder')}
          />
        ) : (
          <Input
            value={mapping.path}
            onChange={(e) => vm.setMapping(input.id, { kind: 'Event', path: e.target.value })}
            placeholder={t('mapping.event.example')}
          />
        );
      case 'Expression':
        return (
          <ExpressionEditor
            value={mapping.expression}
            onChange={(expression) => vm.setMapping(input.id, { kind: 'Expression', expression })}
            placeholder={t('mapping.expression.example')}
            eventFields={vm.eventFields}
            pathRoot={vm.pathRoot}
            inputRoot={vm.inputRoot}
            stepOutputFields={vm.stepOutputFields}
            workflowVariables={vm.workflowVariables}
          />
        );
      case 'Output': {
        return (
          <S.OutputPickerRow>
            <SearchSelect
              options={vm.priorStepOptions}
              value={mapping.stepId}
              onChange={(stepId) => vm.setMapping(input.id, { kind: 'Output', stepId, outputId: '' })}
              placeholder={t('mapping.prior-step.placeholder')}
            />
            <SearchSelect
              options={vm.getStepOutputs(mapping.stepId)}
              value={mapping.outputId}
              onChange={(outputId) => vm.setMapping(input.id, { kind: 'Output', stepId: mapping.stepId, outputId })}
              placeholder={t('mapping.output.placeholder')}
              disabled={!mapping.stepId}
            />
          </S.OutputPickerRow>
        );
      }
      case 'Variable':
        return (
          <Input
            value={mapping.name}
            onChange={(e) => vm.setMapping(input.id, { kind: 'Variable', name: e.target.value })}
            placeholder={t('mapping.variable.placeholder')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {vm.selectedStepIcon && <vm.selectedStepIcon size={22} />}
          <S.Title>
            {t(
              vm.isConditionStep
                ? 'step.edit.condition'
                : vm.isLoopStep
                  ? 'step.edit.loop'
                  : vm.isDefinitionLocked
                    ? 'step.edit'
                    : 'step.add',
            )}
          </S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave || vm.isSaving}
            title={t(vm.isSaving ? 'core.ui/action.saving' : 'core.ui/action.save')}
          >
            <RiSaveLine size={14} />
          </S.SaveBtn>
          {vm.isDefinitionLocked && (
            <S.DeleteBtn onClick={vm.handleDelete} disabled={vm.isSaving} title={t(deleteTitleKey)}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {vm.isConditionStep ? (
        <S.Content>
          <S.Form>
            <InputGroup>
              <Label>{t('core.ui/field.identifier')}</Label>
              <Input value={vm.stepIdentifier} readOnly disabled />
              <S.HelpText>{vm.stepIdentifierHint}</S.HelpText>
            </InputGroup>
            <S.StepsDivider />
            <S.ConditionToolbar>
              <S.ViewToggle>
                <S.ViewToggleBtn
                  $active={vm.conditionViewMode === 'editor'}
                  onClick={() => vm.setConditionViewMode('editor')}
                  title={t('condition.view.editor')}
                >
                  <RiEditLine size={14} />
                </S.ViewToggleBtn>
                <S.ViewToggleBtn
                  $active={vm.conditionViewMode === 'diagram'}
                  onClick={() => vm.setConditionViewMode('diagram')}
                  title={t('condition.view.diagram')}
                >
                  <RiNodeTree size={14} />
                </S.ViewToggleBtn>
              </S.ViewToggle>
            </S.ConditionToolbar>
            {vm.conditionViewMode === 'editor' && (
              <ConditionBuilder
                value={vm.pendingCondition}
                onChange={vm.setPendingCondition}
                eventName={vm.conditionEventName}
                parameters={vm.conditionParameters}
                stepOutputFields={vm.stepOutputFields}
                workflowVariables={vm.workflowVariables}
                inputRoot={vm.inputRoot}
                focusPath={vm.conditionFocusPath}
                onFocusHandled={vm.clearConditionFocusPath}
              />
            )}
            {vm.conditionViewMode === 'diagram' && (
              <ConditionDiagram
                condition={vm.pendingCondition}
                eventName={vm.conditionEventName}
                parameters={vm.conditionParameters}
                onChange={vm.setPendingCondition}
                onRequestEdit={vm.handleRequestConditionEdit}
              />
            )}
          </S.Form>
        </S.Content>
      ) : vm.isLoopStep ? (
        <S.Content>
          <S.Form>
            <InputGroup>
              <Label>{t('core.ui/field.identifier')}</Label>
              <Input value={vm.stepIdentifier} readOnly disabled />
              <S.HelpText>{vm.stepIdentifierHint}</S.HelpText>
            </InputGroup>
            <S.StepsDivider />
            <S.Field>
              <S.FieldHeader>
                <Label>{label(LOOP_SOURCE_INPUT.label)}</Label>
                <S.Required>*</S.Required>
              </S.FieldHeader>
              <S.HelpText>{t('loop.source.hint')}</S.HelpText>
              <S.MappingRow>
                <SearchSelect
                  options={getMappingKindOptions(LOOP_SOURCE_INPUT, t)}
                  value={vm.configuration.source?.kind ?? ''}
                  onChange={(kind) => vm.setMappingKind('source', kind as InputMapping['kind'])}
                  placeholder={t('mapping.source.placeholder')}
                />
                {renderMappingControl(LOOP_SOURCE_INPUT)}
              </S.MappingRow>
            </S.Field>
            <InputGroup>
              <Label>{t('loop.item-name')}</Label>
              <Input
                value={vm.loopItemName}
                onChange={(e) => vm.setLoopItemName(e.target.value)}
                placeholder={t('loop.item-name.placeholder')}
              />
              <S.HelpText>{t('loop.item-name.hint', { name: vm.loopItemName || 'item' })}</S.HelpText>
            </InputGroup>
            <InputGroup>
              <Label>{t('loop.output-name')}</Label>
              <Input
                value={vm.loopOutputName}
                onChange={(e) => vm.setLoopOutputName(e.target.value)}
                placeholder={t('loop.output-name.placeholder')}
              />
              <S.HelpText>{t('loop.output-name.hint')}</S.HelpText>
            </InputGroup>
            <InfoBanner variant="info" message={t('loop.body.notice')} />
          </S.Form>
        </S.Content>
      ) : (
      <S.Content>
        <S.Form>
          <InputGroup>
            <Label>{t('step.type')}</Label>
            <SearchSelect
              options={vm.stepCatalogOptions}
              value={vm.selectedDefinitionId}
              onChange={vm.selectDefinition}
              disabled={vm.isDefinitionLocked}
              placeholder={t('step.type.placeholder')}
            />
            {vm.selectedDefinition && <S.HelpText>{label(vm.selectedDefinition.description)}</S.HelpText>}
          </InputGroup>

          <InputGroup>
            <Label>{t('core.ui/field.identifier')}</Label>
            <Input
              value={vm.stepIdentifier}
              onChange={(e) => vm.setStepIdentifier(e.target.value)}
              placeholder={t('step.identifier.placeholder')}
              disabled={vm.isStepIdentifierLocked}
              readOnly={vm.isStepIdentifierLocked}
            />
            {vm.stepIdentifierError
              ? <S.HelpText $error>{vm.stepIdentifierError}</S.HelpText>
              : <S.HelpText>{vm.stepIdentifierHint}</S.HelpText>}
          </InputGroup>

          {vm.selectedDefinition && vm.effectiveInputs.length > 0 && <S.StepsDivider />}

          {vm.effectiveInputs.map((input) => {
            const mappingKindOptions = getMappingKindOptions(input, t);
            const isMappingKindLocked = mappingKindOptions.length === 1;
            const pickerKind = vm.pickerFor(input);

            if (input.type === 'Boolean') {
              const booleanMapping = vm.configuration[input.id];
              const checked =
                booleanMapping?.kind === 'Literal' ? booleanMapping.value === true : input.defaultValue === true;
              return (
                <S.Field key={input.id}>
                  <Checkbox
                    label={label(input.label)}
                    checked={checked}
                    onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
                  />
                  {input.description && <S.HelpText>{label(input.description)}</S.HelpText>}
                </S.Field>
              );
            }

            return (
              <S.Field key={input.id}>
                <S.FieldHeader>
                  <Label>{label(input.label)}</Label>
                  {input.required && <S.Required>*</S.Required>}
                </S.FieldHeader>
                {input.description && <S.HelpText>{label(input.description)}</S.HelpText>}
                {pickerKind && isMappingKindLocked ? (
                  renderPicker(input, pickerKind)
                ) : pickerKind ? (
                  // O input aceita mais de uma origem: o seletor de origem fica visível ao lado da
                  // lista, senão não haveria como trocar o alvo fixo pela saída de um passo anterior
                  // — e é justamente essa troca que deixa um fluxo escolher a automação em runtime.
                  <S.MappingRow>
                    <SearchSelect
                      options={mappingKindOptions}
                      value={vm.configuration[input.id]?.kind ?? 'Literal'}
                      onChange={(kind) => vm.setMappingKind(input.id, kind as InputMapping['kind'])}
                      placeholder={t('mapping.source.placeholder')}
                    />
                    {renderPicker(input, pickerKind)}
                  </S.MappingRow>
                ) : input.type === 'Query' ? (
                  renderQueryControl(input)
                ) : input.type === 'Upsert' ? (
                  renderUpsertControl(input)
                ) : input.type === 'Remove' ? (
                  renderRemoveControl(input)
                ) : input.type === 'Map' ? (
                  renderMapControl(input)
                ) : input.type === 'Validate' ? (
                  renderValidateControl(input)
                ) : (
                  <S.MappingRow>
                    <SearchSelect
                      options={mappingKindOptions}
                      value={vm.configuration[input.id]?.kind ?? ''}
                      onChange={(kind) => vm.setMappingKind(input.id, kind as InputMapping['kind'])}
                      placeholder={t('mapping.source.placeholder')}
                      disabled={isMappingKindLocked}
                    />
                    {renderMappingControl(input)}
                  </S.MappingRow>
                )}
              </S.Field>
            );
          })}

          {vm.selectedDefinition && vm.priorSteps.length === 0 && (
            <InfoBanner variant="info" message={t('step.no-prior-steps')} />
          )}
        </S.Form>
      </S.Content>
      )}

      <ConfirmModal
        isOpen={!!vm.stepToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={t(deleteTitleKey)}
        message={t(
          vm.isConditionStep
            ? 'step.delete.condition.message'
            : vm.isLoopStep
              ? 'step.delete.loop.message'
              : 'step.delete.message',
        )}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
