import React from 'react';
import { DynamicSelect } from '../../../components/ui/DynamicSelect';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { MultiSearchSelect } from '../../../components/ui/MultiSearchSelect';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { S } from './SettingsOptionsSelect.styles';
import {
  useSettingsOptionsSelectViewModel,
  type SettingsOptionsSelectProps,
} from './SettingsOptionsSelect.viewmodel';

/**
 * O editor de um `select` de Configurações — o MESMO controle que o formulário de registro usa para
 * o campo equivalente, para a pessoa não ter de aprender um segundo.
 */
export const SettingsOptionsSelect: React.FC<SettingsOptionsSelectProps> = (props) => {
  const vm = useSettingsOptionsSelectViewModel(props);

  return (
    <S.Wrapper>
      {vm.notice && <InfoBanner message={vm.notice} variant="info" />}
      {vm.control === 'colored' ? (
        <DynamicSelect
          staticOptions={vm.options}
          multiSelect={vm.multi}
          value={vm.multi ? undefined : vm.single}
          onChange={vm.multi ? undefined : vm.changeSingle}
          values={vm.multi ? vm.values : undefined}
          onChangeMulti={vm.multi ? vm.changeMulti : undefined}
          placeholder={vm.placeholder}
          disabled={vm.disabled}
        />
      ) : vm.multi ? (
        <MultiSearchSelect
          options={vm.options}
          values={vm.values}
          onChange={vm.changeMulti}
          placeholder={vm.placeholder}
          disabled={vm.disabled}
        />
      ) : (
        <SearchSelect
          options={vm.options}
          value={vm.single}
          onChange={vm.changeSingle}
          placeholder={vm.placeholder}
          disabled={vm.disabled}
        />
      )}
    </S.Wrapper>
  );
};
