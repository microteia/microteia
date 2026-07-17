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
import { LiteralOptionsControl } from '../ViewWorkflow/components/LiteralOptionsControl';
import { EntityReferenceControl } from '../ViewWorkflow/components/EntityReferenceControl';
import { QueryBuilderControl } from '../ViewWorkflow/components/QueryBuilderControl';
import { UpsertBuilderControl } from '../ViewWorkflow/components/UpsertBuilderControl';
import { RemoveBuilderControl } from '../ViewWorkflow/components/RemoveBuilderControl';
import { MapBuilderControl } from '../ViewWorkflow/components/MapBuilderControl';
import { ValidateBuilderControl } from '../ViewWorkflow/components/ValidateBuilderControl';
import { S } from './EditWorkflowStep.styles';
import { useEditWorkflowStepViewModel } from './EditWorkflowStep.viewmodel';
import type { InputDefinition } from '../../../domain/entities/WorkflowStepCatalog';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { RemoveStepConfig, UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import { applyFormat, checkValue, toEffectiveRules } from '../../../domain/schema/fieldRules';

const MAPPING_KIND_OPTIONS = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Event', label: 'Do evento' },
  { value: 'Expression', label: 'Expressão' },
  { value: 'Output', label: 'Saída de outro step' },
  { value: 'Variable', label: 'Variável' },
];

const getMappingKindOptions = (input: InputDefinition) => {
  if (!input.allowedMappingKinds || input.allowedMappingKinds.length === 0) {
    return MAPPING_KIND_OPTIONS;
  }
  return MAPPING_KIND_OPTIONS.filter(opt => input.allowedMappingKinds?.includes(opt.value as InputMapping['kind']));
};

// Input sintético para a origem da lista de um nó Loop: reusa os mesmos controles de mapeamento
// dos demais inputs, gravando/lendo em configuration['source'].
const LOOP_SOURCE_INPUT: InputDefinition = {
  id: 'source',
  label: 'Lista de itens',
  type: 'String',
  required: true,
  allowedMappingKinds: ['Output', 'Event', 'Expression', 'Variable'],
};

const literalRuleError = (value: string, input: InputDefinition): string | undefined => {
  const rules = toEffectiveRules(input);
  if (!rules) return undefined;
  return checkValue(applyFormat(value, rules.format), rules.validate, input.label);
};

export const EditWorkflowStepView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useEditWorkflowStepViewModel(tabKey);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

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
          options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]}
          value={String(mapping.value ?? '')}
          onChange={(v) => vm.setMapping(input.id, { kind: 'Literal', value: v === 'true' })}
          placeholder="Selecione..."
        />
      );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      vm.setMapping(input.id, { kind: 'Literal', value: newValue });

      const ruleError = newValue ? literalRuleError(newValue, input) : undefined;
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
            placeholder="Campo do evento..."
          />
        ) : (
          <Input
            value={mapping.path}
            onChange={(e) => vm.setMapping(input.id, { kind: 'Event', path: e.target.value })}
            placeholder="ex: caseId"
          />
        );
      case 'Expression':
        return (
          <ExpressionEditor
            value={mapping.expression}
            onChange={(expression) => vm.setMapping(input.id, { kind: 'Expression', expression })}
            placeholder="ex: event.campo || input.campo || variavel"
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
              placeholder="Step anterior..."
            />
            <SearchSelect
              options={vm.getStepOutputs(mapping.stepId)}
              value={mapping.outputId}
              onChange={(outputId) => vm.setMapping(input.id, { kind: 'Output', stepId: mapping.stepId, outputId })}
              placeholder="Saída..."
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
            placeholder="Nome da variável"
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
          <S.Title>{vm.isConditionStep ? 'Editar Condição' : vm.isLoopStep ? 'Editar Repetição' : (vm.isDefinitionLocked ? 'Editar Step' : 'Adicionar Step')}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave || vm.isSaving}
            title={vm.isSaving ? 'Salvando...' : 'Salvar'}
          >
            <RiSaveLine size={14} />
          </S.SaveBtn>
          {vm.isDefinitionLocked && (
            <S.DeleteBtn onClick={vm.handleDelete} disabled={vm.isSaving} title={vm.isConditionStep ? 'Excluir Condição' : vm.isLoopStep ? 'Excluir Repetição' : 'Excluir Step'}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {vm.isConditionStep ? (
        <S.Content>
          <S.Form>
            <InputGroup>
              <Label>Nome (opcional)</Label>
              <Input
                value={vm.signature}
                onChange={(e) => vm.setSignature(e.target.value)}
                placeholder="ex: Verificar valor da causa"
              />
              <S.HelpText>Nome para identificar esta condição no fluxo.</S.HelpText>
            </InputGroup>
            <S.StepsDivider />
            <S.ConditionToolbar>
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
            </S.ConditionToolbar>
            {vm.conditionViewMode === 'editor' && (
              <ConditionBuilder
                value={vm.pendingCondition}
                onChange={vm.setPendingCondition}
                eventName={vm.conditionEventName}
                screenKey={vm.conditionScreenKey}
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
                screenKey={vm.conditionScreenKey}
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
              <Label>Nome (opcional)</Label>
              <Input
                value={vm.signature}
                onChange={(e) => vm.setSignature(e.target.value)}
                placeholder="ex: Para cada processo encontrado"
              />
              <S.HelpText>Nome para identificar esta repetição no fluxo.</S.HelpText>
            </InputGroup>
            <S.StepsDivider />
            <S.Field>
              <S.FieldHeader>
                <Label>{LOOP_SOURCE_INPUT.label}</Label>
                <S.Required>*</S.Required>
              </S.FieldHeader>
              <S.HelpText>A lista (ou item único) sobre a qual repetir. Cada item roda os steps do corpo da repetição.</S.HelpText>
              <S.MappingRow>
                <SearchSelect
                  options={getMappingKindOptions(LOOP_SOURCE_INPUT)}
                  value={vm.configuration.source?.kind ?? ''}
                  onChange={(kind) => vm.setMappingKind('source', kind as InputMapping['kind'])}
                  placeholder="Origem..."
                />
                {renderMappingControl(LOOP_SOURCE_INPUT)}
              </S.MappingRow>
            </S.Field>
            <InputGroup>
              <Label>Nome do item</Label>
              <Input
                value={vm.loopItemName}
                onChange={(e) => vm.setLoopItemName(e.target.value)}
                placeholder="ex: item"
              />
              <S.HelpText>{`Item escalar fica disponível como input.${vm.loopItemName || 'item'}. Se o item for um objeto, seus campos ficam em input.campo.`}</S.HelpText>
            </InputGroup>
            <InputGroup>
              <Label>Nome da saída</Label>
              <Input
                value={vm.loopOutputName}
                onChange={(e) => vm.setLoopOutputName(e.target.value)}
                placeholder="ex: itens"
              />
              <S.HelpText>O resultado de cada iteração é agrupado num vetor publicado sob este nome para o próximo step.</S.HelpText>
            </InputGroup>
            <InfoBanner variant="info" message="Adicione os steps que rodam a cada item no corpo da repetição, no fluxo do workflow." />
          </S.Form>
        </S.Content>
      ) : (
      <S.Content>
        <S.Form>
          <InputGroup>
            <Label>Tipo de Step</Label>
            <SearchSelect
              options={vm.stepCatalogOptions}
              value={vm.selectedDefinitionId}
              onChange={vm.selectDefinition}
              disabled={vm.isDefinitionLocked}
              placeholder="Selecione um tipo de step..."
            />
            {vm.selectedDefinition && <S.HelpText>{vm.selectedDefinition.description}</S.HelpText>}
          </InputGroup>

          <InputGroup>
            <Label>Nome (opcional)</Label>
            <Input
              value={vm.signature}
              onChange={(e) => vm.setSignature(e.target.value)}
              placeholder="ex: Criar prazo de contestação"
            />
            <S.HelpText>
              Use para diferenciar steps do mesmo tipo. Se deixar em branco, será usado o nome padrão do step.
            </S.HelpText>
          </InputGroup>

          {vm.selectedDefinition && vm.effectiveInputs.length > 0 && <S.StepsDivider />}

          {vm.effectiveInputs.map((input) => {
            const mappingKindOptions = getMappingKindOptions(input);
            const isMappingKindLocked = mappingKindOptions.length === 1;
            const isTargetPicker = input.id === vm.dynamicInputsSourceId;

            if (input.type === 'Boolean') {
              const booleanMapping = vm.configuration[input.id];
              const checked =
                booleanMapping?.kind === 'Literal' ? booleanMapping.value === true : input.defaultValue === true;
              return (
                <S.Field key={input.id}>
                  <Checkbox
                    label={input.label}
                    checked={checked}
                    onChange={(next) => vm.setMapping(input.id, { kind: 'Literal', value: next })}
                  />
                  {input.description && <S.HelpText>{input.description}</S.HelpText>}
                </S.Field>
              );
            }

            return (
              <S.Field key={input.id}>
                <S.FieldHeader>
                  <Label>{input.label}</Label>
                  {input.required && <S.Required>*</S.Required>}
                </S.FieldHeader>
                {input.description && <S.HelpText>{input.description}</S.HelpText>}
                {isTargetPicker ? (
                  <SearchSelect
                    options={vm.dynamicTargetKind === 'script' ? vm.callableScriptOptions : vm.callableWorkflowOptions}
                    value={vm.configuration[input.id]?.kind === 'Literal' ? String((vm.configuration[input.id] as Extract<InputMapping, { kind: 'Literal' }>).value ?? '') : ''}
                    onChange={(value) => vm.setTargetWorkflow(input.id, value)}
                    placeholder={vm.dynamicTargetKind === 'script' ? 'Selecione o script...' : 'Selecione o workflow a chamar...'}
                  />
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
                      placeholder="Origem..."
                      disabled={isMappingKindLocked}
                    />
                    {renderMappingControl(input)}
                  </S.MappingRow>
                )}
              </S.Field>
            );
          })}

          {vm.selectedDefinition && vm.priorSteps.length === 0 && (
            <InfoBanner variant="info" message="Não há steps anteriores neste workflow para usar como origem de 'Saída de outro step'." />
          )}
        </S.Form>
      </S.Content>
      )}

      <ConfirmModal
        isOpen={!!vm.stepToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={vm.isConditionStep ? 'Excluir Condição' : vm.isLoopStep ? 'Excluir Repetição' : 'Excluir Step'}
        message={vm.isConditionStep
          ? 'Excluir esta condição também remove todos os steps dos ramos Verdadeiro e Falso. Esta ação não pode ser desfeita.'
          : vm.isLoopStep
            ? 'Excluir esta repetição também remove todos os steps do seu corpo. Esta ação não pode ser desfeita.'
            : 'Tem certeza que deseja excluir este step? Esta ação não pode ser desfeita.'}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
