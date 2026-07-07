import React from 'react';
import { RiSaveLine, RiDeleteBinLine } from 'react-icons/ri';
import { InputGroup, Label, Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DateInput } from '../../components/ui/DateInput';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
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

const getMappingKindOptions = (input: InputDefinition) => {
  if (!input.allowedMappingKinds || input.allowedMappingKinds.length === 0) {
    return MAPPING_KIND_OPTIONS;
  }
  return MAPPING_KIND_OPTIONS.filter(opt => input.allowedMappingKinds?.includes(opt.value as InputMapping['kind']));
};

const validatePattern = (value: string, pattern?: string): boolean => {
  if (!pattern) return true;
  try {
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return true;
  }
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

      if (input.pattern && newValue) {
        const isValid = validatePattern(newValue, input.pattern);
        setValidationErrors(prev => {
          const next = { ...prev };
          if (isValid) {
            delete next[input.id];
          } else {
            next[input.id] = input.patternMessage ?? 'Formato inválido';
          }
          return next;
        });
      } else {
        setValidationErrors(prev => {
          const next = { ...prev };
          delete next[input.id];
          return next;
        });
      }
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
            stepOutputFields={vm.stepOutputFields}
            workflowVariables={vm.workflowVariables}
          />
        );
      case 'Output': {
        return (
          <S.OutputPickerRow>
            <SearchSelect
              options={vm.priorSteps.map((s) => ({ value: s.id, label: s.name ?? s.stepDefinitionId }))}
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
          <S.Title>{vm.isDefinitionLocked ? 'Editar Step' : 'Adicionar Step'}</S.Title>
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
            <S.DeleteBtn onClick={vm.handleDelete} disabled={vm.isSaving} title="Excluir Step">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

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

          {vm.selectedDefinition && vm.selectedDefinition.inputs.length > 0 && <S.StepsDivider />}

          {vm.selectedDefinition?.inputs.map((input) => {
            const mappingKindOptions = getMappingKindOptions(input);
            const isMappingKindLocked = mappingKindOptions.length === 1;

            return (
              <S.Field key={input.id}>
                <S.FieldHeader>
                  <Label>{input.label}</Label>
                  {input.required && <S.Required>*</S.Required>}
                </S.FieldHeader>
                {input.description && <S.HelpText>{input.description}</S.HelpText>}
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
              </S.Field>
            );
          })}

          {vm.selectedDefinition && vm.priorSteps.length === 0 && (
            <InfoBanner variant="info" message="Não há steps anteriores neste workflow para usar como origem de 'Saída de outro step'." />
          )}
        </S.Form>
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.stepToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Step"
        message="Tem certeza que deseja excluir este step? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
