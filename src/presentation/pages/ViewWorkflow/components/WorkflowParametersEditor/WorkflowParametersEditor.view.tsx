import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiArrowDownSLine, RiArrowRightSLine, RiFileCopyLine } from 'react-icons/ri';
import { Input, Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { DateInput } from '../../../../components/ui/DateInput';
import { S } from './WorkflowParametersEditor.styles';
import { useWorkflowParametersEditorViewModel } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParametersEditorProps } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';
import { siblingParameterErrors, cloneParameterInList } from '../../../../../domain/schema/workflowParameters';
import { isScalarParameterType } from '../../../../../domain/schema/eventCatalog';
import type { FieldRules, FormatPreset, ValidateCheck } from '../../../../../domain/schema/fieldRules';
import { FORMAT_PRESET_LABELS, VALIDATE_CHECK_LABELS } from '../../../../../domain/schema/fieldRules';

const REQUIRED_OPTIONS = [
  { value: 'optional', label: 'Opcional' },
  { value: 'required', label: 'Obrigatório' },
];

const LIST_OPTIONS = [
  { value: 'single', label: 'Único' },
  { value: 'list', label: 'Vários' },
];

const BOOLEAN_DEFAULT_OPTIONS = [
  { value: '', label: 'Sem padrão' },
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

const DefaultValueField: React.FC<{
  parameter: WorkflowParameter;
  index: number;
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
}> = ({ parameter, index, onUpdate }) => {
  const setDefault = (value: unknown) => onUpdate(index, { defaultValue: value });

  if (parameter.type === 'Date') {
    return (
      <DateInput
        value={typeof parameter.defaultValue === 'string' ? parameter.defaultValue : ''}
        onChange={(value) => setDefault(value || undefined)}
      />
    );
  }

  if (parameter.type === 'Boolean') {
    return (
      <SearchSelect
        options={BOOLEAN_DEFAULT_OPTIONS}
        value={parameter.defaultValue === true ? 'true' : parameter.defaultValue === false ? 'false' : ''}
        onChange={(value) => setDefault(value === '' ? undefined : value === 'true')}
        placeholder="Sem padrão"
      />
    );
  }

  if (parameter.type === 'select') {
    return (
      <SearchSelect
        options={[{ value: '', label: 'Sem padrão' }, ...(parameter.options ?? [])]}
        value={typeof parameter.defaultValue === 'string' ? parameter.defaultValue : ''}
        onChange={(value) => setDefault(value || undefined)}
        placeholder="Sem padrão"
      />
    );
  }

  return (
    <Input
      type={parameter.type === 'Number' ? 'number' : 'text'}
      value={parameter.defaultValue === undefined || parameter.defaultValue === null ? '' : String(parameter.defaultValue)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return setDefault(undefined);
        if (parameter.type === 'Number') {
          const parsed = Number(raw);
          return setDefault(Number.isNaN(parsed) ? undefined : parsed);
        }
        return setDefault(raw);
      }}
      placeholder="Sem padrão"
    />
  );
};

export const WorkflowParametersEditor: React.FC<WorkflowParametersEditorProps> = (props) => {
  const { parameters, errors, typeOptions, entityOptions, onUpdate, variant = 'input' } = props;
  const cloneLabel = variant === 'output' ? 'Clonar parâmetro de saída' : 'Clonar parâmetro';
  const vm = useWorkflowParametersEditorViewModel(props);

  return (
    <S.Container>
      {parameters.length === 0 && (
        <S.Empty>
          {variant === 'output' ? 'Nenhum parâmetro de saída declarado.' : 'Nenhum parâmetro. Este workflow pode ser chamado sem receber dados.'}
        </S.Empty>
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
              <S.CloneBtn type="button" onClick={() => vm.handleClone(index)} title={cloneLabel}>
                <RiFileCopyLine size={14} />
              </S.CloneBtn>
              <S.RemoveBtn type="button" onClick={() => vm.handleRemove(index)} title="Remover parâmetro">
                <RiDeleteBinLine size={14} />
              </S.RemoveBtn>
            </S.RowHeader>

            {expanded && (
              <>
                <ParameterFields
                  parameter={parameter}
                  error={errors[index]}
                  index={index}
                  typeOptions={typeOptions}
                  entityOptions={entityOptions}
                  onUpdate={onUpdate}
                  variant={variant}
                />
                {parameter.type === 'Object' && (
                  <S.NestedBox>
                    <S.NestedLabel>Campos do objeto</S.NestedLabel>
                    <WorkflowParametersEditor
                      parameters={parameter.fields ?? []}
                      errors={siblingParameterErrors(parameter.fields ?? [])}
                      typeOptions={typeOptions}
                      entityOptions={entityOptions}
                      variant={variant}
                      onAdd={() =>
                        onUpdate(index, { fields: [...(parameter.fields ?? []), { key: '', label: '', type: 'String' }] })
                      }
                      onUpdate={(childIndex, patch) =>
                        onUpdate(index, {
                          fields: (parameter.fields ?? []).map((field, i) =>
                            i === childIndex ? { ...field, ...patch } : field,
                          ),
                        })
                      }
                      onRemove={(childIndex) =>
                        onUpdate(index, { fields: (parameter.fields ?? []).filter((_, i) => i !== childIndex) })
                      }
                      onClone={(childIndex) =>
                        onUpdate(index, { fields: cloneParameterInList(parameter.fields ?? [], childIndex) })
                      }
                    />
                  </S.NestedBox>
                )}
              </>
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
  variant: NonNullable<WorkflowParametersEditorProps['variant']>;
}> = ({ parameter, error, index, typeOptions, entityOptions, onUpdate, variant }) => {
  const isInput = variant === 'input';
  return (
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
              options: undefined,
              defaultValue: undefined,
              fields: type === 'Object' ? [] : undefined,
            })
          }
          placeholder="Tipo..."
        />
      </S.Cell>
    </S.Line>

    {isInput && parameter.type === 'select' && (
      <S.Cell>
        <Label>Opções da lista</Label>
        <S.OptionsBox>
          {(parameter.options ?? []).length === 0 && (
            <S.OptionsHint>Adicione as opções que o usuário poderá escolher. O valor padrão é definido a partir delas.</S.OptionsHint>
          )}
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

    <S.SubLine>
      {isInput && (
        <S.Cell>
          <Label>Preenchimento</Label>
          <SearchSelect
            options={REQUIRED_OPTIONS}
            value={parameter.required ? 'required' : 'optional'}
            onChange={(value) => onUpdate(index, { required: value === 'required' })}
            placeholder="..."
          />
        </S.Cell>
      )}

      <S.Cell>
        <Label>Quantidade</Label>
        <SearchSelect
          options={LIST_OPTIONS}
          value={parameter.list ? 'list' : 'single'}
          onChange={(value) => onUpdate(index, { list: value === 'list' })}
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

      {isInput && !parameter.list && isScalarParameterType(parameter.type) && (
        <S.Cell>
          <Label>Valor padrão</Label>
          <DefaultValueField parameter={parameter} index={index} onUpdate={onUpdate} />
        </S.Cell>
      )}
    </S.SubLine>

    {isInput && RULES_SUPPORTED_PARAMETER_TYPES.includes(parameter.type) && (
      <ParameterRulesFields parameter={parameter} index={index} onUpdate={onUpdate} />
    )}

  </>
  );
};

const RULES_SUPPORTED_PARAMETER_TYPES: WorkflowParameter['type'][] = ['String', 'Number'];

const FORMAT_PRESET_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  ...(Object.keys(FORMAT_PRESET_LABELS) as FormatPreset[]).map((preset) => ({
    value: preset,
    label: FORMAT_PRESET_LABELS[preset],
  })),
];

const VALIDATE_CHECK_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  ...(Object.keys(VALIDATE_CHECK_LABELS) as ValidateCheck[]).map((check) => ({
    value: check,
    label: VALIDATE_CHECK_LABELS[check],
  })),
];

const ParameterRulesFields: React.FC<{
  parameter: WorkflowParameter;
  index: number;
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
}> = ({ parameter, index, onUpdate }) => {
  const rules = parameter.rules;

  // O valor é guardado cru enquanto o usuário digita (um regex pela metade é inválido, e
  // sanitizar a cada tecla apagaria o que ele está escrevendo). A limpeza final acontece no
  // save, em sanitizeWorkflowParameters.
  const patchRules = (patch: FieldRules) => {
    const format = { ...rules?.format, ...patch.format };
    const validate = { ...rules?.validate, ...patch.validate };
    const next: FieldRules = {};
    if (Object.values(format).some(Boolean)) next.format = format;
    if (Object.values(validate).some(Boolean)) next.validate = validate;
    onUpdate(index, { rules: Object.keys(next).length > 0 ? next : undefined });
  };

  return (
    <>
      <S.SubLine>
        <S.Cell>
          <Label>Formatação pronta</Label>
          <SearchSelect
            options={FORMAT_PRESET_OPTIONS}
            value={rules?.format?.preset ?? ''}
            onChange={(value) => patchRules({ format: { preset: (value || undefined) as FormatPreset | undefined } })}
            placeholder="Nenhuma"
          />
        </S.Cell>
        <S.Cell>
          <Label>Validação pronta</Label>
          <SearchSelect
            options={VALIDATE_CHECK_OPTIONS}
            value={rules?.validate?.check ?? ''}
            onChange={(value) => patchRules({ validate: { check: (value || undefined) as ValidateCheck | undefined } })}
            placeholder="Nenhuma"
          />
        </S.Cell>
      </S.SubLine>

      <S.SubLine>
        <S.Cell>
          <Label>Formatar (procurar)</Label>
          <Input
            value={rules?.format?.pattern ?? ''}
            onChange={(e) => patchRules({ format: { pattern: e.target.value } })}
            placeholder="ex: ^(\d{3})(\d{3})(\d{3})(\d{2})$"
          />
        </S.Cell>
        <S.Cell>
          <Label>Formatar (substituir por)</Label>
          <Input
            value={rules?.format?.replacement ?? ''}
            onChange={(e) => patchRules({ format: { replacement: e.target.value } })}
            placeholder="ex: $1.$2.$3-$4"
          />
        </S.Cell>
      </S.SubLine>

      <S.SubLine>
        <S.Cell>
          <Label>Validar (expressão regular)</Label>
          <Input
            value={rules?.validate?.pattern ?? ''}
            onChange={(e) => patchRules({ validate: { pattern: e.target.value } })}
            placeholder="ex: ^[A-Z]{2}\d{6}$"
          />
        </S.Cell>
        <S.Cell>
          <Label>Mensagem de erro</Label>
          <Input
            value={rules?.validate?.message ?? ''}
            onChange={(e) => patchRules({ validate: { message: e.target.value } })}
            placeholder="Exibida quando o valor não passa"
          />
        </S.Cell>
      </S.SubLine>
    </>
  );
};
