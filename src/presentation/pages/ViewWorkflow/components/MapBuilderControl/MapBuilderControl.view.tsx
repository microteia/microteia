import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { MappingValueControl } from '../MappingValueControl';
import { S } from './MapBuilderControl.styles';
import { useMapBuilderControlViewModel } from './MapBuilderControl.viewmodel';
import type { MapBuilderControlProps } from './MapBuilderControl.viewmodel';

import { useT } from '../../../../shared/i18n/useT';

export const MapBuilderControl: React.FC<MapBuilderControlProps> = (props) => {
  const t = useT('core.automation');
  const vm = useMapBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>{t('map.name')}</S.SectionTitle>
        <Input
          value={config.name ?? ''}
          onChange={(e) => vm.setName(e.target.value)}
          placeholder={t('map.name.placeholder')}
        />
        <S.HelpText>
          {config.name?.trim()
            ? t('map.name.hint', { name: config.name.trim() })
            : t('map.name.hint-empty')}
        </S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('map.type')}</S.SectionTitle>
        <SearchSelect
          options={vm.typeOptions}
          value={config.type ?? ''}
          onChange={vm.setType}
          placeholder={t('map.type.placeholder')}
        />
        <S.HelpText>{t('map.type.hint')}</S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('map.fields')}</S.SectionTitle>
        {config.fields.length === 0 && <S.Empty>{t('map.fields.empty')}</S.Empty>}
        {config.fields.map((field, index) => (
          <S.FieldRow key={index}>
            <Input
              value={field.name}
              onChange={(e) => vm.updateField(index, { ...field, name: e.target.value })}
              placeholder={t('map.field.placeholder')}
            />
            <MappingValueControl
              mapping={field.value}
              onChange={(value) => vm.updateField(index, { ...field, value })}
              eventFields={props.eventFields}
              pathRoot={props.pathRoot}
              inputRoot={props.inputRoot}
              stepOutputFields={props.stepOutputFields}
              workflowVariables={props.workflowVariables}
              priorStepOptions={props.priorStepOptions}
              getStepOutputs={props.getStepOutputs}
            />
            <S.RemoveButton onClick={() => vm.removeField(index)} title={t('map.field.remove')}>
              <RiDeleteBinLine size={14} />
            </S.RemoveButton>
          </S.FieldRow>
        ))}
        <S.AddButton onClick={vm.addField}>
          <RiAddLine size={14} /> {t('map.field.add')}
        </S.AddButton>
      </S.Section>
    </S.Container>
  );
};
