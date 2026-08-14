import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { S } from './UpsertBuilderControl.styles';
import { useUpsertBuilderControlViewModel } from './UpsertBuilderControl.viewmodel';
import type { UpsertBuilderControlProps } from './UpsertBuilderControl.viewmodel';

import { useT } from '../../../../shared/i18n/useT';

export const UpsertBuilderControl: React.FC<UpsertBuilderControlProps> = (props) => {
  const t = useT('core.automation');
  const vm = useUpsertBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>{t('upsert.source')}</S.SectionTitle>
        <SearchSelect
          options={vm.sourceOptions}
          value={config.source}
          onChange={vm.setSource}
          placeholder={t('upsert.source.placeholder')}
        />
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('upsert.property')}</S.SectionTitle>
        <Input
          value={config.property ?? ''}
          onChange={(e) => vm.setProperty(e.target.value)}
          placeholder={t('map.name.placeholder')}
        />
        <S.Empty>{t('upsert.property.hint')}</S.Empty>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('query.table')}</S.SectionTitle>
        <SearchSelect
          options={vm.tableOptions}
          value={config.table}
          onChange={vm.setTable}
          placeholder={t('query.table.placeholder')}
        />
      </S.Section>
    </S.Container>
  );
};
