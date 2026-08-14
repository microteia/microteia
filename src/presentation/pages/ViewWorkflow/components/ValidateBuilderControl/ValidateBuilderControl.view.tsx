import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { WorkflowParametersEditor } from '../WorkflowParametersEditor';
import { S } from './ValidateBuilderControl.styles';
import { useValidateBuilderControlViewModel } from './ValidateBuilderControl.viewmodel';
import type { ValidateBuilderControlProps } from './ValidateBuilderControl.viewmodel';

import { useT } from '../../../../shared/i18n/useT';

export const ValidateBuilderControl: React.FC<ValidateBuilderControlProps> = (props) => {
  const t = useT('core.automation');
  const vm = useValidateBuilderControlViewModel(props.value, props.onChange);
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
        <S.Hint>Deixe em branco para validar o objeto inteiro da origem.</S.Hint>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('validate.entity')}</S.SectionTitle>
        <SearchSelect
          options={vm.entityOptions}
          value={config.entityType ?? ''}
          onChange={vm.setEntityType}
          placeholder={t('validate.source.none')}
        />
        <S.Hint>
          {t('validate.entity.hint')}
        </S.Hint>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('validate.output-name')}</S.SectionTitle>
        <Input
          value={config.outputName}
          onChange={(e) => vm.setOutputName(e.target.value)}
          placeholder="ex: person"
        />
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('field.parameters')}</S.SectionTitle>
        <WorkflowParametersEditor
          parameters={vm.parameters}
          errors={vm.parameterErrors}
          typeOptions={vm.typeOptions}
          entityOptions={vm.entityOptions}
          lookupOptions={vm.lookupOptions}
          onAdd={vm.addParameter}
          onUpdate={vm.updateParameter}
          onRemove={vm.removeParameter}
          onClone={vm.cloneParameter}
        />
      </S.Section>
    </S.Container>
  );
};
