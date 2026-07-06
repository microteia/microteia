import React from 'react';
import { Button } from '../../components/ui/Button';
import { InputGroup, Label, Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DateInput } from '../../components/ui/DateInput';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { LiteralOptionsControl } from '../ViewWorkflow/components/StepEditorModal/components/LiteralOptionsControl';
import { EntityReferenceControl } from '../ViewWorkflow/components/StepEditorModal/components/EntityReferenceControl';
import { S } from './EditWorkflowStep.styles';
import { useEditWorkflowStepViewModel } from './EditWorkflowStep.viewmodel';
import type { InputDefinition } from '../../../domain/entities/WorkflowStepCatalog';
import type { InputMapping } from '../../../domain/entities/Workflow';

const MAPPING_KIND_OPTIONS = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Event', label: 'Do evento' },
  { value: 'Expression', label: 'Expressão' },
  { value: 'Output', label: 'Saída de outro step' },
  { value: 'Variable', label: 'Variável' },
];

export const EditWorkflowStepView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useEditWorkflowStepViewModel(tabKey);

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
    return (
      <Input
        type={input.type === 'Number' ? 'number' : 'text'}
        value={String(mapping.value ?? '')}
        onChange={(e) => vm.setMapping(input.id, { kind: 'Literal', value: e.target.value })}
        placeholder={input.description}
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
            placeholder="ex: today() + 5 ou event.customValues.campo"
            eventFields={vm.eventFields}
          />
        );
      case 'Output': {
        const priorStep = vm.priorSteps.find((s) => s.id === mapping.stepId);
        const priorDefinition = priorStep ? vm.stepCatalog.find((s) => s.id === priorStep.stepDefinitionId) : undefined;
        return (
          <S.OutputPickerRow>
            <SearchSelect
              options={vm.priorSteps.map((s) => ({ value: s.id, label: s.name ?? s.stepDefinitionId }))}
              value={mapping.stepId}
              onChange={(stepId) => vm.setMapping(input.id, { kind: 'Output', stepId, outputId: '' })}
              placeholder="Step anterior..."
            />
            <SearchSelect
              options={(priorDefinition?.outputDefinitions ?? []).map((o) => ({ value: o.id, label: o.label }))}
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
        <S.Title>{vm.isDefinitionLocked ? 'Editar Step' : 'Adicionar Step'}</S.Title>
        <S.HeaderActions>
          <Button variant="secondary" onClick={vm.handleCancel} disabled={vm.isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void vm.handleSave()} disabled={!vm.canSave || vm.isSaving}>
            {vm.isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Form>
          <InputGroup>
            <Label>Tipo de Step</Label>
            <SearchSelect
              options={vm.stepCatalog.map((s) => ({ value: s.id, label: s.name }))}
              value={vm.selectedDefinitionId}
              onChange={vm.selectDefinition}
              disabled={vm.isDefinitionLocked}
              placeholder="Selecione um tipo de step..."
            />
            {vm.selectedDefinition && <S.HelpText>{vm.selectedDefinition.description}</S.HelpText>}
          </InputGroup>

          {vm.selectedDefinition && vm.selectedDefinition.inputs.length > 0 && <S.StepsDivider />}

          {vm.selectedDefinition?.inputs.map((input) => (
            <S.Field key={input.id}>
              <S.FieldHeader>
                <Label>{input.label}</Label>
                {input.required && <S.Required>*</S.Required>}
              </S.FieldHeader>
              {input.description && <S.HelpText>{input.description}</S.HelpText>}
              <S.MappingRow>
                <SearchSelect
                  options={MAPPING_KIND_OPTIONS}
                  value={vm.configuration[input.id]?.kind ?? ''}
                  onChange={(kind) => vm.setMappingKind(input.id, kind as InputMapping['kind'])}
                  placeholder="Origem..."
                />
                {renderMappingControl(input)}
              </S.MappingRow>
            </S.Field>
          ))}

          {vm.selectedDefinition && vm.priorSteps.length === 0 && (
            <InfoBanner variant="info" message="Não há steps anteriores neste workflow para usar como origem de 'Saída de outro step'." />
          )}
        </S.Form>
      </S.Content>
    </S.Page>
  );
};
