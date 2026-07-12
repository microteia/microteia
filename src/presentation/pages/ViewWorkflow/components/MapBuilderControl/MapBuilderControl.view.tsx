import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { MappingValueControl } from '../MappingValueControl';
import { S } from './MapBuilderControl.styles';
import { useMapBuilderControlViewModel } from './MapBuilderControl.viewmodel';
import type { MapBuilderControlProps } from './MapBuilderControl.viewmodel';

export const MapBuilderControl: React.FC<MapBuilderControlProps> = (props) => {
  const vm = useMapBuilderControlViewModel(props.value, props.onChange);
  const { config } = vm;

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Nome do objeto</S.SectionTitle>
        <Input
          value={config.name}
          onChange={(e) => vm.setName(e.target.value)}
          placeholder="ex: person"
        />
        <S.HelpText>Este nome fica disponível para os próximos steps como input.{config.name || 'nome'}.</S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Tipo (opcional)</S.SectionTitle>
        <SearchSelect
          options={vm.typeOptions}
          value={config.type ?? ''}
          onChange={vm.setType}
          placeholder="Selecione um cadastro para ajudar no preenchimento..."
        />
        <S.HelpText>Só ajuda no preenchimento dos próximos steps — não altera a gravação.</S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Campos</S.SectionTitle>
        {config.fields.length === 0 && <S.Empty>Nenhum campo — adicione ao menos um campo.</S.Empty>}
        {config.fields.map((field, index) => (
          <S.FieldRow key={index}>
            <Input
              value={field.name}
              onChange={(e) => vm.updateField(index, { ...field, name: e.target.value })}
              placeholder="Nome do campo..."
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
            <S.RemoveButton onClick={() => vm.removeField(index)} title="Remover campo">
              <RiDeleteBinLine size={14} />
            </S.RemoveButton>
          </S.FieldRow>
        ))}
        <S.AddButton onClick={vm.addField}>
          <RiAddLine size={14} /> Adicionar campo
        </S.AddButton>
      </S.Section>
    </S.Container>
  );
};
