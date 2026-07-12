import React from 'react';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { WorkflowParametersEditor } from '../WorkflowParametersEditor';
import { S } from './ValidateBuilderControl.styles';
import { useValidateBuilderControlViewModel } from './ValidateBuilderControl.viewmodel';
import type { ValidateBuilderControlProps } from './ValidateBuilderControl.viewmodel';

export const ValidateBuilderControl: React.FC<ValidateBuilderControlProps> = (props) => {
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
        <S.SectionTitle>Entidade (opcional)</S.SectionTitle>
        <SearchSelect
          options={vm.entityOptions}
          value={config.entityType ?? ''}
          onChange={vm.setEntityType}
          placeholder="Nenhuma (objeto anônimo)"
        />
        <S.Hint>
          Com entidade e sem parâmetros, o objeto é validado pelo schema dela. Com os dois, a saída continua sendo
          dessa entidade, mas as regras dos parâmetros substituem as do schema. Sem entidade, a saída é um objeto
          formado apenas pelos parâmetros.
        </S.Hint>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Nome do objeto de saída</S.SectionTitle>
        <Input
          value={config.outputName}
          onChange={(e) => vm.setOutputName(e.target.value)}
          placeholder="ex: person"
        />
      </S.Section>

      <S.Section>
        <S.SectionTitle>Parâmetros</S.SectionTitle>
        <WorkflowParametersEditor
          parameters={vm.parameters}
          errors={vm.parameterErrors}
          typeOptions={vm.typeOptions}
          entityOptions={vm.entityOptions}
          onAdd={vm.addParameter}
          onUpdate={vm.updateParameter}
          onRemove={vm.removeParameter}
          onClone={vm.cloneParameter}
        />
      </S.Section>
    </S.Container>
  );
};
