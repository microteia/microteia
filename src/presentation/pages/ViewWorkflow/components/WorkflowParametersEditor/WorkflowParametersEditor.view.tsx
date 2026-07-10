import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import { Input, Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { S } from './WorkflowParametersEditor.styles';
import { useWorkflowParametersEditorViewModel } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParametersEditorProps } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';

const REQUIRED_OPTIONS = [
  { value: 'optional', label: 'Opcional' },
  { value: 'required', label: 'Obrigatório' },
];

const MULTI_OPTIONS = [
  { value: 'single', label: 'Único' },
  { value: 'multi', label: 'Vários' },
];

export const WorkflowParametersEditor: React.FC<WorkflowParametersEditorProps> = (props) => {
  const { parameters, errors, typeOptions, entityOptions, onUpdate } = props;
  const vm = useWorkflowParametersEditorViewModel(props);

  return (
    <S.Container>
      {parameters.length === 0 && (
        <S.Empty>Nenhum parâmetro. Este workflow pode ser chamado sem receber dados.</S.Empty>
      )}

      {parameters.map((parameter, index) => {
        const expanded = vm.isExpanded(index);
        return (
          <S.Row key={index}>
            <S.RowHeader>
              <S.CollapseBtn
                type="button"
                onClick={() => vm.toggle(index)}
                title={expanded ? 'Recolher parâmetro' : 'Expandir parâmetro'}
              >
                {expanded ? <RiArrowDownSLine size={18} /> : <RiArrowRightSLine size={18} />}
              </S.CollapseBtn>
              {expanded ? (
                <S.HeaderTitle>{parameter.label.trim() || parameter.key.trim() || 'Novo parâmetro'}</S.HeaderTitle>
              ) : (
                <S.Summary type="button" onClick={() => vm.toggle(index)}>
                  {vm.summaryFor(parameter)}
                </S.Summary>
              )}
              {errors[index] && !expanded && <S.Error>{errors[index]}</S.Error>}
              <S.RemoveBtn type="button" onClick={() => vm.handleRemove(index)} title="Remover parâmetro">
                <RiDeleteBinLine size={14} />
              </S.RemoveBtn>
            </S.RowHeader>

            {expanded && (
              <ParameterFields
                parameter={parameter}
                error={errors[index]}
                index={index}
                typeOptions={typeOptions}
                entityOptions={entityOptions}
                onUpdate={onUpdate}
              />
            )}
          </S.Row>
        );
      })}

      <S.AddBtn type="button" onClick={vm.handleAdd}>
        <RiAddLine size={14} /> Adicionar parâmetro
      </S.AddBtn>
    </S.Container>
  );
};

const ParameterFields: React.FC<{
  parameter: WorkflowParameter;
  error: string | undefined;
  index: number;
  typeOptions: WorkflowParametersEditorProps['typeOptions'];
  entityOptions: WorkflowParametersEditorProps['entityOptions'];
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
}> = ({ parameter, error, index, typeOptions, entityOptions, onUpdate }) => (
  <>
    <S.Line>
      <S.Cell>
        <Label>Descrição</Label>
        <Input
          value={parameter.label}
          onChange={(e) => onUpdate(index, { label: e.target.value })}
          placeholder="ex: Order ID"
        />
      </S.Cell>
      <S.Cell>
        <Label>Nome do parâmetro</Label>
        <Input
          value={parameter.key}
          onChange={(e) => onUpdate(index, { key: e.target.value })}
          placeholder="ex: orderId"
        />
        {error && <S.Error>{error}</S.Error>}
      </S.Cell>
      <S.Cell>
        <Label>Tipo</Label>
        <SearchSelect
          options={typeOptions}
          value={parameter.type}
          onChange={(type) =>
            onUpdate(index, {
              type: type as WorkflowParameter['type'],
              entityType: undefined,
              multi: undefined,
              options: undefined,
            })
          }
          placeholder="Tipo..."
        />
      </S.Cell>
    </S.Line>

    <S.SubLine>
      <S.Cell>
        <Label>Preenchimento</Label>
        <SearchSelect
          options={REQUIRED_OPTIONS}
          value={parameter.required ? 'required' : 'optional'}
          onChange={(value) => onUpdate(index, { required: value === 'required' })}
          placeholder="..."
        />
      </S.Cell>

      {parameter.type === 'EntityReference' && (
        <S.Cell>
          <Label>Entidade referenciada</Label>
          <SearchSelect
            options={entityOptions}
            value={parameter.entityType ?? ''}
            onChange={(entityType) => onUpdate(index, { entityType })}
            placeholder="Selecione a entidade..."
          />
        </S.Cell>
      )}
    </S.SubLine>

    {parameter.type === 'EntityReference' && (
      <S.SubLine>
        <S.Cell>
          <Label>Quantidade</Label>
          <SearchSelect
            options={MULTI_OPTIONS}
            value={parameter.multi ? 'multi' : 'single'}
            onChange={(value) => onUpdate(index, { multi: value === 'multi' })}
            placeholder="..."
          />
        </S.Cell>
      </S.SubLine>
    )}

    {parameter.type === 'select' && (
      <S.Cell>
        <Label>Opções da lista</Label>
        <S.OptionsBox>
          {(parameter.options ?? []).map((option, optionIndex) => (
            <S.OptionRow key={optionIndex}>
              <Input
                value={option.label}
                onChange={(e) => {
                  const nextOptions = [...(parameter.options ?? [])];
                  nextOptions[optionIndex] = { value: e.target.value, label: e.target.value };
                  onUpdate(index, { options: nextOptions });
                }}
                placeholder="ex: Alta"
              />
              <S.RemoveBtn
                type="button"
                onClick={() =>
                  onUpdate(index, { options: (parameter.options ?? []).filter((_, i) => i !== optionIndex) })
                }
                title="Remover opção"
              >
                <RiDeleteBinLine size={14} />
              </S.RemoveBtn>
            </S.OptionRow>
          ))}
          <S.AddBtn
            type="button"
            onClick={() => onUpdate(index, { options: [...(parameter.options ?? []), { value: '', label: '' }] })}
          >
            <RiAddLine size={14} /> Adicionar opção
          </S.AddBtn>
        </S.OptionsBox>
      </S.Cell>
    )}
  </>
);
