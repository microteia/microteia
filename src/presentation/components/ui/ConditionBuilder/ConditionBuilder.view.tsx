import React from 'react';
import { RiDeleteBinLine, RiAddLine } from 'react-icons/ri';
import { S } from './ConditionBuilder.styles';
import { useConditionBuilderViewModel } from './ConditionBuilder.viewmodel';
import type { Condition } from '../../../../domain/entities/Workflow';
import { SearchSelect } from '../SearchSelect';
import { Input } from '../Input';
import { ExpressionEditor } from '../ExpressionEditor';

export interface ConditionBuilderProps {
  value: Condition;
  onChange: (condition: Condition) => void;
  eventName: string;
  screenKey?: string;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange, eventName, screenKey }) => {
  const vm = useConditionBuilderViewModel(value, onChange, eventName, screenKey);

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Quando executar esta automação?</S.SectionTitle>

        <S.RadioGroup>
          <S.RadioOption>
            <input
              type="radio"
              checked={vm.mode === 'always'}
              onChange={() => vm.setMode('always')}
            />
            <label>Sempre que o evento ocorrer</label>
          </S.RadioOption>

          <S.RadioOption>
            <input
              type="radio"
              checked={vm.mode === 'custom'}
              onChange={() => vm.setMode('custom')}
            />
            <label>Apenas quando as seguintes condições forem atendidas</label>
          </S.RadioOption>
        </S.RadioGroup>
      </S.Section>

      {vm.mode === 'custom' && (
        <S.Section>
          <S.ConditionsContainer>
            {vm.conditions.map((condition, index) => (
              <S.ConditionCard key={index}>
                <S.ConditionHeader>
                  <S.ConditionLabel>Condição {index + 1}</S.ConditionLabel>
                  {vm.conditions.length > 1 && (
                    <S.RemoveButton onClick={() => vm.removeCondition(index)} title="Remover condição">
                      <RiDeleteBinLine size={14} />
                    </S.RemoveButton>
                  )}
                </S.ConditionHeader>

                <S.ConditionRow>
                  <S.FieldGroup>
                    <S.Label>Campo</S.Label>
                    <SearchSelect
                      options={vm.fieldOptions}
                      value={condition.fieldPath}
                      onChange={(path) => vm.updateCondition(index, { fieldPath: path })}
                      placeholder="Selecione um campo..."
                    />
                  </S.FieldGroup>

                  <S.FieldGroup>
                    <S.Label>Operador</S.Label>
                    <SearchSelect
                      options={vm.operatorOptions}
                      value={condition.operator}
                      onChange={(op) => vm.updateCondition(index, { operator: op as typeof condition.operator })}
                      placeholder="Selecione..."
                    />
                  </S.FieldGroup>
                </S.ConditionRow>

                {condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (
                  <>
                    <S.ValueTypeRow>
                      <S.RadioOption>
                        <input
                          type="radio"
                          checked={condition.valueType === 'literal'}
                          onChange={() => vm.updateCondition(index, { valueType: 'literal' })}
                        />
                        <label>Valor fixo</label>
                      </S.RadioOption>

                      <S.RadioOption>
                        <input
                          type="radio"
                          checked={condition.valueType === 'expression'}
                          onChange={() => vm.updateCondition(index, { valueType: 'expression' })}
                        />
                        <label>Expressão</label>
                      </S.RadioOption>

                      <S.RadioOption>
                        <input
                          type="radio"
                          checked={condition.valueType === 'eventField'}
                          onChange={() => vm.updateCondition(index, { valueType: 'eventField' })}
                        />
                        <label>Outro campo do evento</label>
                      </S.RadioOption>
                    </S.ValueTypeRow>

                    <S.FieldGroup>
                      <S.Label>Valor</S.Label>
                      {condition.valueType === 'literal' && (
                        <Input
                          value={String(condition.value)}
                          onChange={(e) => vm.updateCondition(index, { value: e.target.value })}
                          placeholder='Ex: "Ativo", 1000, etc.'
                        />
                      )}
                      {condition.valueType === 'expression' && (
                        <ExpressionEditor
                          value={String(condition.value)}
                          onChange={(expr) => vm.updateCondition(index, { value: expr })}
                          placeholder='Ex: today(), now(), concat("Texto", campo)'
                        />
                      )}
                      {condition.valueType === 'eventField' && (
                        <SearchSelect
                          options={vm.fieldOptions}
                          value={String(condition.value)}
                          onChange={(path) => vm.updateCondition(index, { value: path })}
                          placeholder="Selecione um campo..."
                        />
                      )}
                    </S.FieldGroup>
                  </>
                )}
              </S.ConditionCard>
            ))}

            <S.AddButton onClick={vm.addCondition}>
              <RiAddLine size={16} />
              Adicionar condição (E)
            </S.AddButton>
          </S.ConditionsContainer>

          <S.HelpText>
            Todas as condições devem ser verdadeiras para o workflow executar (operador E / AND).
          </S.HelpText>
        </S.Section>
      )}
    </S.Container>
  );
};
