import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { S } from './UpsertBuilderControl.styles';
import { useUpsertBuilderControlViewModel } from './UpsertBuilderControl.viewmodel';
import type { UpsertBuilderControlProps } from './UpsertBuilderControl.viewmodel';

export const UpsertBuilderControl: React.FC<UpsertBuilderControlProps> = (props) => {
  const vm = useUpsertBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Origem dos dados</S.SectionTitle>
        <SearchSelect
          options={vm.sourceOptions}
          value={config.source}
          onChange={vm.setSource}
          placeholder="Selecione a origem..."
        />
      </S.Section>

      <S.Section>
        <S.SectionTitle>Propriedade (opcional)</S.SectionTitle>
        <Input
          value={config.property ?? ''}
          onChange={(e) => vm.setProperty(e.target.value)}
          placeholder="ex: person"
        />
        <S.Empty>Deixe em branco para gravar o objeto inteiro da origem.</S.Empty>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Tabela</S.SectionTitle>
        <SearchSelect
          options={vm.tableOptions}
          value={config.table}
          onChange={vm.setTable}
          placeholder="Selecione a tabela..."
        />
      </S.Section>
    </S.Container>
  );
};
