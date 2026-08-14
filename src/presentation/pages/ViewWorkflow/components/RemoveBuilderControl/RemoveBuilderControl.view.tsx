import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { ExpressionEditor } from '../../../../components/ui/ExpressionEditor';
import { S } from './RemoveBuilderControl.styles';
import { useRemoveBuilderControlViewModel } from './RemoveBuilderControl.viewmodel';
import type { RemoveBuilderControlProps } from './RemoveBuilderControl.viewmodel';

import { useT, type TranslateFn } from '../../../../shared/i18n/useT';

const valueKindOptions = (t: TranslateFn) => [
  { value: 'Literal', label: t('mapping.kind.literal') },
  { value: 'Expression', label: t('mapping.kind.expression') },
];

export const RemoveBuilderControl: React.FC<RemoveBuilderControlProps> = (props) => {
  const t = useT('core.automation');
  const vm = useRemoveBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;
  const kind = config.id?.kind === 'Expression' ? 'Expression' : 'Literal';

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>{t('query.table')}</S.SectionTitle>
        <SearchSelect
          options={vm.tableOptions}
          value={config.table}
          onChange={vm.setTable}
          placeholder={t('query.table.placeholder')}
        />
      </S.Section>

      {config.table && (
        <S.Section>
          <S.SectionTitle>{t('remove.record-id')}</S.SectionTitle>
          <S.ValueEditor>
            <SearchSelect
              options={valueKindOptions(t)}
              value={kind}
              onChange={(next) =>
                vm.setId(next === 'Expression' ? { kind: 'Expression', expression: '' } : { kind: 'Literal', value: '' })
              }
            />
            {kind === 'Expression' ? (
              <ExpressionEditor
                value={config.id?.kind === 'Expression' ? config.id.expression : ''}
                onChange={(expression) => vm.setId({ kind: 'Expression', expression })}
                placeholder={t('remove.expression.placeholder')}
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
                placeholder={t('remove.record-id.placeholder')}
              />
            )}
          </S.ValueEditor>
        </S.Section>
      )}
    </S.Container>
  );
};
