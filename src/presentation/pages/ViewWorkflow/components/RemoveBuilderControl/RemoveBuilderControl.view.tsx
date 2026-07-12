import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { ExpressionEditor } from '../../../../components/ui/ExpressionEditor';
import { S } from './RemoveBuilderControl.styles';
import { useRemoveBuilderControlViewModel } from './RemoveBuilderControl.viewmodel';
import type { RemoveBuilderControlProps } from './RemoveBuilderControl.viewmodel';

const VALUE_KIND_OPTIONS = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Expression', label: 'Expressão' },
];

export const RemoveBuilderControl: React.FC<RemoveBuilderControlProps> = (props) => {
  const vm = useRemoveBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;
  const kind = config.id?.kind === 'Expression' ? 'Expression' : 'Literal';

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
        <S.Section>
          <S.SectionTitle>Id do registro a excluir</S.SectionTitle>
          <S.ValueEditor>
            <SearchSelect
              options={VALUE_KIND_OPTIONS}
              value={kind}
              onChange={(next) =>
                vm.setId(next === 'Expression' ? { kind: 'Expression', expression: '' } : { kind: 'Literal', value: '' })
              }
            />
            {kind === 'Expression' ? (
              <ExpressionEditor
                value={config.id?.kind === 'Expression' ? config.id.expression : ''}
                onChange={(expression) => vm.setId({ kind: 'Expression', expression })}
                placeholder="ex: query('...').first.id"
                eventFields={props.eventFields}
                pathRoot={props.pathRoot}
                inputRoot={props.inputRoot}
                stepOutputFields={props.stepOutputFields}
                workflowVariables={props.workflowVariables}
              />
            ) : (
              <Input
                value={config.id?.kind === 'Literal' ? String(config.id.value ?? '') : ''}
                onChange={(e) => vm.setId({ kind: 'Literal', value: e.target.value })}
                placeholder="Id do registro"
              />
            )}
          </S.ValueEditor>
        </S.Section>
      )}
    </S.Container>
  );
};
