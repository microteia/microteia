import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../../../components/ui/MultiSearchSelect';
import { Input } from '../../../../components/ui/Input';
import { ExpressionEditor } from '../../../../components/ui/ExpressionEditor';
import { S } from './QueryBuilderControl.styles';
import { operatorNeedsValue, useQueryBuilderControlViewModel } from './QueryBuilderControl.viewmodel';
import type { QueryBuilderControlProps } from './QueryBuilderControl.viewmodel';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { QueryOperator } from '../../../../../domain/schema/querySpec';

const VALUE_KIND_OPTIONS = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Expression', label: 'Expressão' },
];

const DIRECTION_OPTIONS = [
  { value: 'asc', label: 'Crescente' },
  { value: 'desc', label: 'Decrescente' },
];

export const QueryBuilderControl: React.FC<QueryBuilderControlProps> = (props) => {
  const vm = useQueryBuilderControlViewModel(props.value, props.onChange);
  const { spec } = vm;

  const renderValueEditor = (index: number, mapping: InputMapping | undefined) => {
    const kind = mapping?.kind === 'Expression' ? 'Expression' : 'Literal';
    const predicate = spec.where[index];
    return (
      <S.ValueEditor>
        <S.KindRow>
          <SearchSelect
            options={VALUE_KIND_OPTIONS}
            value={kind}
            onChange={(next) =>
              vm.updateFilter(index, {
                ...predicate,
                value: next === 'Expression' ? { kind: 'Expression', expression: '' } : { kind: 'Literal', value: '' },
              })
            }
          />
          {kind === 'Expression' ? (
            <ExpressionEditor
              value={mapping?.kind === 'Expression' ? mapping.expression : ''}
              onChange={(expression) => vm.updateFilter(index, { ...predicate, value: { kind: 'Expression', expression } })}
              placeholder="ex: event.status"
              eventFields={props.eventFields}
              pathRoot={props.pathRoot}
              inputRoot={props.inputRoot}
              stepOutputFields={props.stepOutputFields}
              workflowVariables={props.workflowVariables}
            />
          ) : (
            <Input
              value={mapping?.kind === 'Literal' ? String(mapping.value ?? '') : ''}
              onChange={(e) => vm.updateFilter(index, { ...predicate, value: { kind: 'Literal', value: e.target.value } })}
              placeholder="Valor"
            />
          )}
        </S.KindRow>
      </S.ValueEditor>
    );
  };

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Tabela</S.SectionTitle>
        <SearchSelect
          options={vm.tableOptions}
          value={spec.table}
          onChange={vm.setTable}
          placeholder="Selecione a tabela..."
        />
        {vm.issuesByField.table && <S.Issue>{vm.issuesByField.table}</S.Issue>}
      </S.Section>

      {spec.table && (
        <>
          <S.Section>
            <S.SectionTitle>Filtros</S.SectionTitle>
            {spec.where.length === 0 && <S.Empty>Nenhum filtro — todos os registros da tabela serão retornados.</S.Empty>}
            {spec.where.map((predicate, index) => (
              <React.Fragment key={index}>
                <S.FilterRow>
                  <SearchSelect
                    options={vm.pathOptions}
                    value={predicate.path}
                    onChange={(path) => vm.updateFilter(index, { ...predicate, path })}
                    placeholder="Campo..."
                  />
                  <SearchSelect
                    options={vm.operatorOptions}
                    value={predicate.op}
                    onChange={(op) => vm.updateFilter(index, { ...predicate, op: op as QueryOperator })}
                    placeholder="Operador..."
                  />
                  {operatorNeedsValue(predicate.op) ? renderValueEditor(index, predicate.value) : <span />}
                  <S.RemoveButton onClick={() => vm.removeFilter(index)} title="Remover filtro">
                    <RiDeleteBinLine size={14} />
                  </S.RemoveButton>
                </S.FilterRow>
                {vm.issuesByField[`where[${index}].path`] && <S.Issue>{vm.issuesByField[`where[${index}].path`]}</S.Issue>}
              </React.Fragment>
            ))}
            <S.AddButton onClick={vm.addFilter}>
              <RiAddLine size={14} /> Adicionar filtro
            </S.AddButton>
          </S.Section>

          <S.Section>
            <S.SectionTitle>Projeções (campos retornados)</S.SectionTitle>
            <MultiSearchSelect
              options={vm.pathOptions}
              values={spec.projections}
              onChange={vm.setProjections}
              placeholder="Todos os campos (padrão)"
            />
          </S.Section>

          <S.Section>
            <S.SectionTitle>Ordenação</S.SectionTitle>
            {spec.orderBy?.map((order, index) => (
              <S.OrderRow key={index}>
                <SearchSelect
                  options={vm.pathOptions}
                  value={order.path}
                  onChange={(path) => vm.updateOrderBy(index, { ...order, path })}
                  placeholder="Campo..."
                />
                <SearchSelect
                  options={DIRECTION_OPTIONS}
                  value={order.dir}
                  onChange={(dir) => vm.updateOrderBy(index, { ...order, dir: dir === 'desc' ? 'desc' : 'asc' })}
                />
                <S.RemoveButton onClick={() => vm.removeOrderBy(index)} title="Remover ordenação">
                  <RiDeleteBinLine size={14} />
                </S.RemoveButton>
              </S.OrderRow>
            ))}
            <S.AddButton onClick={vm.addOrderBy}>
              <RiAddLine size={14} /> Adicionar ordenação
            </S.AddButton>
          </S.Section>

          <S.Section>
            <S.SectionTitle>Limite</S.SectionTitle>
            <S.LimitRow>
              <Input
                type="number"
                value={String(spec.limit)}
                onChange={(e) => vm.setLimit(Number(e.target.value))}
              />
            </S.LimitRow>
          </S.Section>
        </>
      )}
    </S.Container>
  );
};
