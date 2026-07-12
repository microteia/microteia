import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { ExpressionEditor } from '../../../../components/ui/ExpressionEditor';
import { S } from './MappingValueControl.styles';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { PathRoot } from '../../../../../domain/schema/pathResolver';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';

type MappingKind = InputMapping['kind'];

const ALL_KIND_OPTIONS: { value: MappingKind; label: string }[] = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Event', label: 'Do evento' },
  { value: 'Expression', label: 'Expressão' },
  { value: 'Output', label: 'Saída de outro step' },
  { value: 'Variable', label: 'Variável' },
];

const emptyMappingFor = (kind: MappingKind): InputMapping => {
  switch (kind) {
    case 'Literal': return { kind: 'Literal', value: '' };
    case 'Event': return { kind: 'Event', path: '' };
    case 'Expression': return { kind: 'Expression', expression: '' };
    case 'Output': return { kind: 'Output', stepId: '', outputId: '' };
    case 'Variable': return { kind: 'Variable', name: '' };
    default: return { kind: 'Literal', value: '' };
  }
};

export interface MappingValueControlProps {
  mapping: InputMapping | undefined;
  onChange: (mapping: InputMapping) => void;
  allowedKinds?: MappingKind[];
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  priorStepOptions: SearchSelectOption[];
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
}

export const MappingValueControl: React.FC<MappingValueControlProps> = (props) => {
  const { mapping, onChange } = props;
  const kindOptions = props.allowedKinds
    ? ALL_KIND_OPTIONS.filter((opt) => props.allowedKinds?.includes(opt.value))
    : ALL_KIND_OPTIONS;

  const renderEditor = () => {
    if (!mapping) return null;
    switch (mapping.kind) {
      case 'Literal':
        return (
          <Input
            value={String(mapping.value ?? '')}
            onChange={(e) => onChange({ kind: 'Literal', value: e.target.value })}
            placeholder="Valor"
          />
        );
      case 'Event':
        return props.eventFields.length > 0 ? (
          <SearchSelect
            options={props.eventFields.map((f) => ({ value: f.path, label: f.label }))}
            value={mapping.path}
            onChange={(path) => onChange({ kind: 'Event', path })}
            placeholder="Campo do evento..."
          />
        ) : (
          <Input
            value={mapping.path}
            onChange={(e) => onChange({ kind: 'Event', path: e.target.value })}
            placeholder="ex: caseId"
          />
        );
      case 'Expression':
        return (
          <ExpressionEditor
            value={mapping.expression}
            onChange={(expression) => onChange({ kind: 'Expression', expression })}
            placeholder="ex: event.campo || input.campo || variavel"
            eventFields={props.eventFields}
            pathRoot={props.pathRoot}
            inputRoot={props.inputRoot}
            stepOutputFields={props.stepOutputFields}
            workflowVariables={props.workflowVariables}
          />
        );
      case 'Output':
        return (
          <S.OutputPickerRow>
            <SearchSelect
              options={props.priorStepOptions}
              value={mapping.stepId}
              onChange={(stepId) => onChange({ kind: 'Output', stepId, outputId: '' })}
              placeholder="Step anterior..."
            />
            <SearchSelect
              options={props.getStepOutputs(mapping.stepId)}
              value={mapping.outputId}
              onChange={(outputId) => onChange({ kind: 'Output', stepId: mapping.stepId, outputId })}
              placeholder="Saída..."
              disabled={!mapping.stepId}
            />
          </S.OutputPickerRow>
        );
      case 'Variable':
        return (
          <Input
            value={mapping.name}
            onChange={(e) => onChange({ kind: 'Variable', name: e.target.value })}
            placeholder="Nome da variável"
          />
        );
      default:
        return null;
    }
  };

  return (
    <S.MappingRow>
      <SearchSelect
        options={kindOptions}
        value={mapping?.kind ?? ''}
        onChange={(kind) => onChange(emptyMappingFor(kind as MappingKind))}
        placeholder="Origem..."
        disabled={kindOptions.length === 1}
      />
      {renderEditor()}
    </S.MappingRow>
  );
};
