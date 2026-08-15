import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiArrowDownSLine, RiArrowRightSLine, RiFileCopyLine } from 'react-icons/ri';
import { Input, Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { DateInput } from '../../../../components/ui/DateInput';
import { LiteralOptionsControl } from '../../../../components/ui/LiteralOptionsControl';
import { S } from './WorkflowParametersEditor.styles';
import { useWorkflowParametersEditorViewModel } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParametersEditorProps } from './WorkflowParametersEditor.viewmodel';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';
import { siblingParameterErrors, cloneParameterInList } from '../../../../../domain/schema/workflowParameters';
import { isScalarParameterType } from '../../../../../domain/schema/eventCatalog';
import type { FieldRules, FormatPreset, ValidateCheck } from '../../../../../domain/schema/fieldRules';
import type { FieldRulePresetOption } from '../../../../shared/useFieldRulePresets';
import { parameterToInputDefinition } from '../../../../shared/parameterInputs';

import { useT, useLabel, type TranslateFn } from '../../../../shared/i18n/useT';

const requiredOptions = (t: TranslateFn) => [
  { value: 'optional', label: t('parameter.optional') },
  { value: 'required', label: t('parameter.required') },
];

const listOptions = (t: TranslateFn) => [
  { value: 'single', label: t('parameter.single') },
  { value: 'list', label: t('parameter.list') },
];

const booleanDefaultOptions = (t: TranslateFn) => [
  { value: '', label: t('parameter.no-default') },
  { value: 'true', label: t('core.ui/boolean.yes') },
  { value: 'false', label: t('core.ui/boolean.no') },
];

const DefaultValueField: React.FC<{
  parameter: WorkflowParameter;
  index: number;
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
}> = ({ parameter, index, onUpdate }) => {
  const t = useT('core.automation');
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
        options={booleanDefaultOptions(t)}
        value={parameter.defaultValue === true ? 'true' : parameter.defaultValue === false ? 'false' : ''}
        onChange={(value) => setDefault(value === '' ? undefined : value === 'true')}
        placeholder={t('parameter.no-default')}
      />
    );
  }

  if (parameter.type === 'lookup') {
    return (
      <LiteralOptionsControl
        input={parameterToInputDefinition(parameter)}
        value={typeof parameter.defaultValue === 'string' ? parameter.defaultValue : ''}
        onChange={(value) => setDefault(value || undefined)}
      />
    );
  }

  if (parameter.type === 'select') {
    return (
      <SearchSelect
        options={[{ value: '', label: t('parameter.no-default') }, ...(parameter.options ?? [])]}
        value={typeof parameter.defaultValue === 'string' ? parameter.defaultValue : ''}
        onChange={(value) => setDefault(value || undefined)}
        placeholder={t('parameter.no-default')}
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
      placeholder={t('parameter.no-default')}
    />
  );
};

export const WorkflowParametersEditor: React.FC<WorkflowParametersEditorProps> = (props) => {
  const { parameters, errors, typeOptions, entityOptions, lookupOptions, onUpdate, variant = 'input' } = props;
  const t = useT('core.automation');
  const label = useLabel();
  const cloneLabel = t(variant === 'output' ? 'parameter.clone.output' : 'parameter.clone');
  const vm = useWorkflowParametersEditorViewModel(props);

  return (
    <S.Container>
      {parameters.length === 0 && (
        <S.Empty>
          {t(variant === 'output' ? 'parameter.empty.output' : 'parameter.empty.input')}
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
                title={t(expanded ? 'parameter.collapse' : 'parameter.expand')}
              >
                {expanded ? <RiArrowDownSLine size={18} /> : <RiArrowRightSLine size={18} />}
              </S.CollapseBtn>
              {expanded ? (
                <S.HeaderTitle>{parameter.label.trim() || parameter.key.trim() || t('parameter.new')}</S.HeaderTitle>
              ) : (
                <S.Summary type="button" onClick={() => vm.toggle(index)}>
                  {vm.summaryFor(parameter)}
                </S.Summary>
              )}
              {errors[index] && !expanded && <S.Error>{errors[index]}</S.Error>}
              <S.CloneBtn type="button" onClick={() => vm.handleClone(index)} title={cloneLabel}>
                <RiFileCopyLine size={14} />
              </S.CloneBtn>
              <S.RemoveBtn type="button" onClick={() => vm.handleRemove(index)} title={t('parameter.remove')}>
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
                  lookupOptions={lookupOptions}
                  onUpdate={onUpdate}
                  variant={variant}
                  formatOptions={vm.formatOptions}
                  validateOptions={vm.validateOptions}
                />
                {parameter.type === 'Object' && (
                  <S.NestedBox>
                    <S.NestedLabel>{t('parameter.object-fields')}</S.NestedLabel>
                    <WorkflowParametersEditor
                      parameters={parameter.fields ?? []}
                      errors={siblingParameterErrors(parameter.fields ?? []).map(
                        (issue) => (issue ? label(issue.message, issue.messageParams) : undefined),
                      )}
                      typeOptions={typeOptions}
                      entityOptions={entityOptions}
                      lookupOptions={lookupOptions}
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
        <RiAddLine size={14} /> {t('parameter.add')}
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
  lookupOptions: WorkflowParametersEditorProps['lookupOptions'];
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
  variant: NonNullable<WorkflowParametersEditorProps['variant']>;
  formatOptions: FieldRulePresetOption[];
  validateOptions: FieldRulePresetOption[];
}> = ({ parameter, error, index, typeOptions, entityOptions, lookupOptions, onUpdate, variant, formatOptions, validateOptions }) => {
  const t = useT('core.automation');
  const isInput = variant === 'input';
  return (
  <>
    <S.Line>
      <S.Cell>
        <Label>{t('field.description')}</Label>
        <Input
          value={parameter.label}
          onChange={(e) => onUpdate(index, { label: e.target.value })}
          placeholder={t('parameter.label.placeholder')}
        />
      </S.Cell>
      <S.Cell>
        <Label>{t('parameter.name')}</Label>
        <Input
          value={parameter.key}
          onChange={(e) => onUpdate(index, { key: e.target.value })}
          placeholder={t('parameter.key.placeholder')}
        />
        {error && <S.Error>{error}</S.Error>}
      </S.Cell>
      <S.Cell>
        <Label>{t('parameter.type')}</Label>
        <SearchSelect
          options={typeOptions}
          value={parameter.type}
          onChange={(type) =>
            onUpdate(index, {
              type: type as WorkflowParameter['type'],
              entityType: undefined,
              lookupCollection: undefined,
              options: undefined,
              defaultValue: undefined,
              fields: type === 'Object' ? [] : undefined,
            })
          }
          placeholder={t('parameter.type.placeholder')}
        />
      </S.Cell>
    </S.Line>

    {isInput && parameter.type === 'select' && (
      <S.Cell>
        <Label>{t('parameter.options')}</Label>
        <S.OptionsBox>
          {(parameter.options ?? []).length === 0 && (
            <S.OptionsHint>{t('parameter.options.hint')}</S.OptionsHint>
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
                placeholder={t('parameter.option.placeholder')}
              />
              <S.RemoveBtn
                type="button"
                onClick={() =>
                  onUpdate(index, { options: (parameter.options ?? []).filter((_, i) => i !== optionIndex) })
                }
                title={t('parameter.option.remove')}
              >
                <RiDeleteBinLine size={14} />
              </S.RemoveBtn>
            </S.OptionRow>
          ))}
          <S.AddBtn
            type="button"
            onClick={() => onUpdate(index, { options: [...(parameter.options ?? []), { value: '', label: '' }] })}
          >
            <RiAddLine size={14} /> {t('parameter.option.add')}
          </S.AddBtn>
        </S.OptionsBox>
      </S.Cell>
    )}

    <S.SubLine>
      {isInput && (
        <S.Cell>
          <Label>{t('parameter.filling')}</Label>
          <SearchSelect
            options={requiredOptions(t)}
            value={parameter.required ? 'required' : 'optional'}
            onChange={(value) => onUpdate(index, { required: value === 'required' })}
            placeholder="..."
          />
        </S.Cell>
      )}

      <S.Cell>
        <Label>{t('parameter.cardinality')}</Label>
        <SearchSelect
          options={listOptions(t)}
          value={parameter.list ? 'list' : 'single'}
          onChange={(value) => onUpdate(index, { list: value === 'list' })}
          placeholder="..."
        />
      </S.Cell>

      {parameter.type === 'EntityReference' && (
        <S.Cell>
          <Label>{t('parameter.entity')}</Label>
          <SearchSelect
            options={entityOptions}
            value={parameter.entityType ?? ''}
            onChange={(entityType) => onUpdate(index, { entityType })}
            placeholder={t('parameter.entity.placeholder')}
          />
        </S.Cell>
      )}

      {parameter.type === 'lookup' && (
        <S.Cell>
          <Label>{t('parameter.lookup')}</Label>
          <SearchSelect
            options={lookupOptions}
            value={parameter.lookupCollection ?? ''}
            onChange={(lookupCollection) => onUpdate(index, { lookupCollection })}
            placeholder={t('parameter.lookup.placeholder')}
          />
        </S.Cell>
      )}

      {isInput && !parameter.list && isScalarParameterType(parameter.type) && (
        <S.Cell>
          <Label>{t('parameter.default')}</Label>
          <DefaultValueField parameter={parameter} index={index} onUpdate={onUpdate} />
        </S.Cell>
      )}
    </S.SubLine>

    {isInput && RULES_SUPPORTED_PARAMETER_TYPES.includes(parameter.type) && (
      <ParameterRulesFields
        parameter={parameter}
        index={index}
        onUpdate={onUpdate}
        formatOptions={formatOptions}
        validateOptions={validateOptions}
      />
    )}

  </>
  );
};

const RULES_SUPPORTED_PARAMETER_TYPES: WorkflowParameter['type'][] = ['String', 'Number'];

const ParameterRulesFields: React.FC<{
  parameter: WorkflowParameter;
  index: number;
  onUpdate: WorkflowParametersEditorProps['onUpdate'];
  formatOptions: FieldRulePresetOption[];
  validateOptions: FieldRulePresetOption[];
}> = ({ parameter, index, onUpdate, formatOptions, validateOptions }) => {
  const t = useT('core.automation');
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
          <Label>{t('parameter.format-preset')}</Label>
          <SearchSelect
            options={formatOptions}
            value={rules?.format?.preset ?? ''}
            onChange={(value) => patchRules({ format: { preset: (value || undefined) as FormatPreset | undefined } })}
            placeholder={t('parameter.preset.none')}
          />
        </S.Cell>
        <S.Cell>
          <Label>{t('parameter.validate-preset')}</Label>
          <SearchSelect
            options={validateOptions}
            value={rules?.validate?.check ?? ''}
            onChange={(value) => patchRules({ validate: { check: (value || undefined) as ValidateCheck | undefined } })}
            placeholder={t('parameter.preset.none')}
          />
        </S.Cell>
      </S.SubLine>

      <S.SubLine>
        <S.Cell>
          <Label>{t('parameter.format.search')}</Label>
          <Input
            value={rules?.format?.pattern ?? ''}
            onChange={(e) => patchRules({ format: { pattern: e.target.value } })}
            placeholder={t('parameter.format.search.placeholder')}
          />
        </S.Cell>
        <S.Cell>
          <Label>{t('parameter.format.replace')}</Label>
          <Input
            value={rules?.format?.replacement ?? ''}
            onChange={(e) => patchRules({ format: { replacement: e.target.value } })}
            placeholder={t('parameter.format.replace.placeholder')}
          />
        </S.Cell>
      </S.SubLine>

      <S.SubLine>
        <S.Cell>
          <Label>{t('parameter.validate-regex')}</Label>
          <Input
            value={rules?.validate?.pattern ?? ''}
            onChange={(e) => patchRules({ validate: { pattern: e.target.value } })}
            placeholder={t('parameter.validate.placeholder')}
          />
        </S.Cell>
        <S.Cell>
          <Label>{t('parameter.error-message')}</Label>
          <Input
            value={rules?.validate?.message ?? ''}
            onChange={(e) => patchRules({ validate: { message: e.target.value } })}
            placeholder={t('parameter.validate-message.placeholder')}
          />
        </S.Cell>
      </S.SubLine>
    </>
  );
};
