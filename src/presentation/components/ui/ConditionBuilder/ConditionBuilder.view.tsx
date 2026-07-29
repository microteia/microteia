import React from 'react';
import { RiDeleteBinLine, RiAddLine, RiFunctionLine, RiBracesLine, RiParenthesesLine, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import { S } from './ConditionBuilder.styles';
import { useConditionBuilderViewModel } from './ConditionBuilder.viewmodel';
import type { BuilderNode, ConditionBuilderViewModel } from './ConditionBuilder.viewmodel';
import type { Condition, WorkflowParameter } from '../../../../domain/entities/Workflow';
import type { PathRoot } from '../../../../domain/schema/pathResolver';
import type { StepOutputField, WorkflowVariable } from '../ExpressionEditor/autocompleteHelpers';
import { SearchSelect } from '../SearchSelect';
import { Input } from '../Input';
import { ExpressionEditor } from '../ExpressionEditor';
import { RadioGroup } from '../RadioButton';

export interface ConditionBuilderProps {
  value: Condition;
  onChange: (condition: Condition) => void;
  eventName: string;
  focusPath?: number[] | null;
  onFocusHandled?: () => void;
  parameters?: WorkflowParameter[];
  // Escopo extra de intellisense para expressões (ex.: saídas de steps anteriores em um
  // StepCondition). Quando omitido, o builder enxerga apenas event./parâmetros.
  stepOutputFields?: StepOutputField[];
  workflowVariables?: WorkflowVariable[];
  inputRoot?: PathRoot | null;
}

const ConditionNode: React.FC<{ node: BuilderNode; vm: ConditionBuilderViewModel; isRoot?: boolean }> = ({ node, vm, isRoot = false }) => {
  if (node.type === 'group') {
    const collapsed = vm.isCollapsed(node.id);
    return (
      <S.GroupCard $operator={node.operator} id={`condition-node-${node.id}`} $focused={vm.focusedNodeId === node.id}>
        <S.GroupHeader>
          <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? 'Expandir grupo' : 'Recolher grupo'}>
            {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
          </S.CollapseBtn>
          <S.OperatorToggle>
            <S.OperatorBtn $active={node.operator === 'and'} onClick={() => vm.setGroupOperator(node.id, 'and')} title="Todas as condições devem ser verdadeiras">
              E
            </S.OperatorBtn>
            <S.OperatorBtn $active={node.operator === 'or'} onClick={() => vm.setGroupOperator(node.id, 'or')} title="Pelo menos uma condição deve ser verdadeira">
              OU
            </S.OperatorBtn>
          </S.OperatorToggle>
          {!isRoot && (
            <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title="Inverter o resultado do grupo (NÃO)">
              NÃO
            </S.NegateBtn>
          )}
          {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
          <S.GroupActions>
            <S.GroupActionBtn onClick={() => vm.addComparison(node.id)} title="Adicionar comparação de campo">
              <RiAddLine size={14} />
              Condição
            </S.GroupActionBtn>
            <S.GroupActionBtn onClick={() => vm.addExpression(node.id)} title="Adicionar expressão pura">
              <RiFunctionLine size={14} />
              Expressão
            </S.GroupActionBtn>
            <S.GroupActionBtn onClick={() => vm.addGroup(node.id)} title="Adicionar grupo aninhado">
              <RiBracesLine size={14} />
              Grupo
            </S.GroupActionBtn>
            {node.children.length > 1 && (
              <S.GroupActionBtn
                onClick={() => vm.wrapGroupChildren(node.id)}
                title="Envolver as condições deste grupo em um subgrupo — depois alterne o E/OU externo para montar lógicas como (A e B) ou C"
              >
                <RiParenthesesLine size={14} />
                Agrupar
              </S.GroupActionBtn>
            )}
            {!isRoot && (
              <S.RemoveButton onClick={() => vm.removeNode(node.id)} title="Remover grupo">
                <RiDeleteBinLine size={14} />
              </S.RemoveButton>
            )}
          </S.GroupActions>
        </S.GroupHeader>

        {!collapsed && (
          <S.GroupChildren>
            {node.children.map((child, index) => (
              <React.Fragment key={child.id}>
                {index > 0 && (
                  <S.JoinPill $operator={node.operator}>{node.operator === 'and' ? 'E' : 'OU'}</S.JoinPill>
                )}
                <ConditionNode node={child} vm={vm} />
              </React.Fragment>
            ))}
          </S.GroupChildren>
        )}
      </S.GroupCard>
    );
  }

  if (node.type === 'expression') {
    const collapsed = vm.isCollapsed(node.id);
    return (
      <S.ConditionCard id={`condition-node-${node.id}`} $focused={vm.focusedNodeId === node.id}>
        <S.ConditionHeader>
          <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? 'Expandir' : 'Recolher'}>
            {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
          </S.CollapseBtn>
          <S.ConditionLabel>Expressão</S.ConditionLabel>
          {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
          <S.HeaderActions>
            <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title="Inverter o resultado (NÃO)">
              NÃO
            </S.NegateBtn>
            <S.RemoveButton onClick={() => vm.removeNode(node.id)} title="Remover expressão">
              <RiDeleteBinLine size={14} />
            </S.RemoveButton>
          </S.HeaderActions>
        </S.ConditionHeader>
        {!collapsed && (
          <>
            <ExpressionEditor
              value={node.expression}
              onChange={(expression) => vm.updateExpression(node.id, expression)}
              placeholder="Ex: event.valor > 1000 and isWeekend(today()) == false"
              eventFields={vm.eventFields}
              pathRoot={vm.pathRoot}
              stepOutputFields={vm.stepOutputFields}
              workflowVariables={vm.workflowVariables}
              inputRoot={vm.inputRoot}
            />
            <S.HelpText>A expressão deve resultar em verdadeiro ou falso.</S.HelpText>
          </>
        )}
      </S.ConditionCard>
    );
  }

  const collapsed = vm.isCollapsed(node.id);
  return (
    <S.ConditionCard id={`condition-node-${node.id}`} $focused={vm.focusedNodeId === node.id}>
      <S.ConditionHeader>
        <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? 'Expandir' : 'Recolher'}>
          {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
        </S.CollapseBtn>
        <S.ConditionLabel>Comparação</S.ConditionLabel>
        {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
        <S.HeaderActions>
          <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title="Inverter o resultado (NÃO)">
            NÃO
          </S.NegateBtn>
          <S.RemoveButton onClick={() => vm.removeNode(node.id)} title="Remover condição">
            <RiDeleteBinLine size={14} />
          </S.RemoveButton>
        </S.HeaderActions>
      </S.ConditionHeader>

      {collapsed ? null : (<>
      <S.ConditionRow>
        <S.FieldGroup>
          <S.Label>Campo</S.Label>
          <SearchSelect
            options={vm.fieldOptions}
            value={node.fieldPath}
            onChange={(path) => vm.updateComparison(node.id, { fieldPath: path })}
            placeholder="Selecione um campo..."
          />
        </S.FieldGroup>

        <S.FieldGroup>
          <S.Label>Operador</S.Label>
          <SearchSelect
            options={vm.operatorOptions}
            value={node.operator}
            onChange={(op) => vm.updateComparison(node.id, { operator: op as typeof node.operator })}
            placeholder="Selecione..."
          />
        </S.FieldGroup>
      </S.ConditionRow>

      {node.operator !== 'isEmpty' && node.operator !== 'isNotEmpty' && (
        <>
          <S.ValueTypeRow>
            <RadioGroup
              name={`value-type-${node.id}`}
              value={node.valueType}
              onChange={(valueType) => vm.updateComparison(node.id, { valueType: valueType as typeof node.valueType })}
              options={[
                { label: 'Valor fixo', value: 'literal' },
                { label: 'Expressão', value: 'expression' },
                { label: 'Outro campo do evento', value: 'eventField' },
              ]}
            />
          </S.ValueTypeRow>

          <S.FieldGroup>
            <S.Label>Valor</S.Label>
            {node.valueType === 'literal' && (() => {
              const lookupOptions = vm.getLookupValueOptions(node.fieldPath);
              return lookupOptions ? (
                <SearchSelect
                  options={lookupOptions}
                  value={node.value}
                  onChange={(value) => vm.updateComparison(node.id, { value })}
                  placeholder="Selecione um valor..."
                />
              ) : (
                <Input
                  value={node.value}
                  onChange={(e) => vm.updateComparison(node.id, { value: e.target.value })}
                  placeholder='Ex: "Ativo", 1000, etc.'
                />
              );
            })()}
            {node.valueType === 'expression' && (
              <ExpressionEditor
                value={node.value}
                onChange={(value) => vm.updateComparison(node.id, { value })}
                placeholder='Ex: today(), now(), concat("Texto", campo)'
                eventFields={vm.eventFields}
                pathRoot={vm.pathRoot}
                stepOutputFields={vm.stepOutputFields}
                workflowVariables={vm.workflowVariables}
                inputRoot={vm.inputRoot}
              />
            )}
            {node.valueType === 'eventField' && (
              <SearchSelect
                options={vm.fieldOptions}
                value={node.value}
                onChange={(path) => vm.updateComparison(node.id, { value: path })}
                placeholder="Selecione um campo..."
              />
            )}
          </S.FieldGroup>
        </>
      )}
      </>)}
    </S.ConditionCard>
  );
};

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange, eventName, focusPath, onFocusHandled, parameters, stepOutputFields, workflowVariables, inputRoot }) => {
  const vm = useConditionBuilderViewModel(value, onChange, eventName, focusPath, onFocusHandled, parameters, stepOutputFields, workflowVariables, inputRoot);

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Quando executar esta automação?</S.SectionTitle>

        <RadioGroup
          name="execution-mode"
          value={vm.mode}
          onChange={(mode) => vm.setMode(mode as 'always' | 'custom')}
          options={[
            { label: 'Sempre que o evento ocorrer', value: 'always' },
            { label: 'Apenas quando as seguintes condições forem atendidas', value: 'custom' },
          ]}
        />
      </S.Section>

      {vm.mode === 'custom' && (
        <S.Section>
          <ConditionNode node={vm.root} vm={vm} isRoot />
          <S.HelpText>
            Combine condições com E/OU e use grupos aninhados para montar lógicas como (A e B) ou C.
          </S.HelpText>
        </S.Section>
      )}
    </S.Container>
  );
};
