import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { ExpressionEditor } from '../../../../components/ui/ExpressionEditor';
import { S } from './UpsertBuilderControl.styles';
import { useUpsertBuilderControlViewModel } from './UpsertBuilderControl.viewmodel';
import type { UpsertBuilderControlProps } from './UpsertBuilderControl.viewmodel';
import type { InputMapping } from '../../../../../domain/entities/Workflow';

const VALUE_KIND_OPTIONS = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Expression', label: 'Expressão' },
];

export const UpsertBuilderControl: React.FC<UpsertBuilderControlProps> = (props) => {
  const vm = useUpsertBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;

  const renderValueEditor = (mapping: InputMapping | undefined, onChange: (next: InputMapping) => void) => {
    const kind = mapping?.kind === 'Expression' ? 'Expression' : 'Literal';
    return (
      <S.ValueEditor>
        <SearchSelect
          options={VALUE_KIND_OPTIONS}
          value={kind}
          onChange={(next) =>
            onChange(next === 'Expression' ? { kind: 'Expression', expression: '' } : { kind: 'Literal', value: '' })
          }
        />
        {kind === 'Expression' ? (
          <ExpressionEditor
            value={mapping?.kind === 'Expression' ? mapping.expression : ''}
            onChange={(expression) => onChange({ kind: 'Expression', expression })}
            placeholder="ex: event.campo || input.campo"
            eventFields={props.eventFields}
            pathRoot={props.pathRoot}
            inputRoot={props.inputRoot}
            stepOutputFields={props.stepOutputFields}
            workflowVariables={props.workflowVariables}
          />
        ) : (
          <Input
            value={mapping?.kind === 'Literal' ? String(mapping.value ?? '') : ''}
            onChange={(e) => onChange({ kind: 'Literal', value: e.target.value })}
            placeholder="Valor"
          />
        )}
      </S.ValueEditor>
    );
  };

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Tabela</S.SectionTitle>
        <SearchSelect
          options={vm.tableOptions}
          value={config.table}
          onChange={vm.setTable}
          placeholder="Selecione a tabela..."
        />
      </S.Section>

      {config.table && (
        <>
          <S.Section>
            <S.SectionTitle>Id (deixe em branco para incluir)</S.SectionTitle>
            {renderValueEditor(config.id, vm.setId)}
          </S.Section>

          <S.Section>
            <S.SectionTitle>Campos a gravar</S.SectionTitle>
            {config.fields.length === 0 && <S.Empty>Nenhum campo — adicione ao menos um campo para gravar.</S.Empty>}
            {config.fields.map((field, index) => (
              <React.Fragment key={index}>
                <S.FieldRow>
                  <SearchSelect
                    options={vm.pathOptions}
                    value={field.path}
                    onChange={(path) => vm.updateField(index, { ...field, path })}
                    placeholder="Campo..."
                  />
                  {renderValueEditor(field.value, (value) => vm.updateField(index, { ...field, value }))}
                  <S.RemoveButton onClick={() => vm.removeField(index)} title="Remover campo">
                    <RiDeleteBinLine size={14} />
                  </S.RemoveButton>
                </S.FieldRow>
                {vm.issuesByPath[index] && <S.Issue>{vm.issuesByPath[index]}</S.Issue>}
              </React.Fragment>
            ))}
            <S.AddButton onClick={vm.addField}>
              <RiAddLine size={14} /> Adicionar campo
            </S.AddButton>
          </S.Section>
        </>
      )}
    </S.Container>
  );
};
