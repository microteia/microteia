import React from 'react';
import { RiCheckDoubleLine, RiFunctionLine, RiAddLine, RiBracesLine, RiEditLine, RiDeleteBinLine, RiParenthesesLine, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import { S } from './ConditionDiagram.styles';
import { useConditionDiagramViewModel } from './ConditionDiagram.viewmodel';
import type { ConditionDiagramProps, ConditionDiagramViewModel, ConditionPath } from './ConditionDiagram.viewmodel';
import type { Condition } from '../../../../domain/entities/Workflow';

const DiagramNode: React.FC<{
  condition: Condition;
  vm: ConditionDiagramViewModel;
  path: ConditionPath;
  parentIsNot?: boolean;
}> = ({ condition, vm, path, parentIsNot = false }) => {
  switch (condition.kind) {
    case 'AlwaysTrue':
      return (
        <S.AlwaysPill>
          <RiCheckDoubleLine size={16} />
          Sempre executa
        </S.AlwaysPill>
      );

    case 'Not':
      return (
        <S.NotWrapper>
          <S.NotBadge
            onClick={() => vm.toggleNegated(path)}
            disabled={!vm.isInteractive}
            title="Remover negação"
          >
            NÃO
          </S.NotBadge>
          <DiagramNode condition={condition.condition} vm={vm} path={[...path, 0]} parentIsNot />
        </S.NotWrapper>
      );

    case 'LogicalAnd':
    case 'LogicalOr': {
      const operator = condition.kind === 'LogicalAnd' ? 'and' : 'or';
      const joinLabel = operator === 'and' ? 'e' : 'ou';
      const collapsed = vm.isCollapsed(path);
      const childCount = condition.conditions.length;
      return (
        <S.Group $operator={operator}>
          <S.GroupHeader>
            <S.CollapseBtn onClick={() => vm.toggleCollapsed(path)} title={collapsed ? 'Expandir grupo' : 'Recolher grupo'}>
              {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
            </S.CollapseBtn>
            <S.GroupBadge
              $operator={operator}
              onClick={() => vm.toggleGroupOperator(path)}
              disabled={!vm.isInteractive}
              title="Alternar entre E e OU"
            >
              {operator === 'and' ? 'TODAS (E)' : 'QUALQUER (OU)'}
            </S.GroupBadge>
            {collapsed && (
              <S.EmptyHint>{childCount} {childCount === 1 ? 'condição oculta' : 'condições ocultas'}</S.EmptyHint>
            )}
            {vm.isInteractive && (
              <S.NodeActions>
                <S.ActionBtn title="Adicionar condição" onClick={() => vm.addComparison(path)}>
                  <RiAddLine size={13} />
                </S.ActionBtn>
                <S.ActionBtn title="Adicionar expressão" onClick={() => vm.addExpression(path)}>
                  <RiFunctionLine size={13} />
                </S.ActionBtn>
                <S.ActionBtn title="Adicionar grupo" onClick={() => vm.addGroup(path)}>
                  <RiBracesLine size={13} />
                </S.ActionBtn>
                {condition.conditions.length > 1 && (
                  <S.ActionBtn
                    title="Envolver as condições deste grupo em um subgrupo"
                    onClick={() => vm.wrapGroupChildren(path)}
                  >
                    <RiParenthesesLine size={13} />
                  </S.ActionBtn>
                )}
                {!parentIsNot && (
                  <S.ActionBtn title="Negar o grupo (NÃO)" onClick={() => vm.toggleNegated(path)}>
                    NÃO
                  </S.ActionBtn>
                )}
                {path.length > 0 && (
                  <S.ActionBtn $danger title="Remover grupo" onClick={() => vm.removeNode(path)}>
                    <RiDeleteBinLine size={13} />
                  </S.ActionBtn>
                )}
              </S.NodeActions>
            )}
          </S.GroupHeader>
          {!collapsed && (
            <S.GroupChildren>
              {condition.conditions.map((child, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <S.JoinLabel $operator={operator}>{joinLabel}</S.JoinLabel>}
                  <DiagramNode condition={child} vm={vm} path={[...path, index]} />
                </React.Fragment>
              ))}
            </S.GroupChildren>
          )}
        </S.Group>
      );
    }

    case 'Expression':
      return (
        <S.Leaf>
          <S.ExpressionChip>
            <RiFunctionLine size={12} />
            {condition.expression || <S.EmptyHint>expressão vazia</S.EmptyHint>}
          </S.ExpressionChip>
          {vm.isInteractive && (
            <S.NodeActions>
              {!parentIsNot && (
                <S.ActionBtn title="Negar (NÃO)" onClick={() => vm.toggleNegated(path)}>NÃO</S.ActionBtn>
              )}
              <S.ActionBtn title="Editar no editor de condições" onClick={() => vm.requestEdit(path)}>
                <RiEditLine size={13} />
              </S.ActionBtn>
              {path.length > 0 && (
                <S.ActionBtn $danger title="Remover expressão" onClick={() => vm.removeNode(path)}>
                  <RiDeleteBinLine size={13} />
                </S.ActionBtn>
              )}
            </S.NodeActions>
          )}
        </S.Leaf>
      );

    case 'FieldComparison': {
      const needsValue = condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty';
      return (
        <S.Leaf>
          {condition.fieldPath
            ? <S.FieldChip>{vm.getFieldLabel(condition.fieldPath)}</S.FieldChip>
            : <S.EmptyHint>campo não definido</S.EmptyHint>}
          <S.OperatorText>{vm.getOperatorLabel(condition.operator)}</S.OperatorText>
          {needsValue && condition.valueType === 'literal' && (
            String(condition.value ?? '') !== ''
              ? <S.ValueChip>{String(condition.value)}</S.ValueChip>
              : <S.EmptyHint>valor não definido</S.EmptyHint>
          )}
          {needsValue && condition.valueType === 'expression' && (
            <S.ExpressionChip>
              <RiFunctionLine size={12} />
              {String(condition.value ?? '') || <S.EmptyHint>expressão vazia</S.EmptyHint>}
            </S.ExpressionChip>
          )}
          {needsValue && condition.valueType === 'eventField' && (
            String(condition.value ?? '') !== ''
              ? <S.FieldChip>{vm.getFieldLabel(String(condition.value))}</S.FieldChip>
              : <S.EmptyHint>campo não definido</S.EmptyHint>
          )}
          {vm.isInteractive && (
            <S.NodeActions>
              {!parentIsNot && (
                <S.ActionBtn title="Negar (NÃO)" onClick={() => vm.toggleNegated(path)}>NÃO</S.ActionBtn>
              )}
              <S.ActionBtn title="Editar no editor de condições" onClick={() => vm.requestEdit(path)}>
                <RiEditLine size={13} />
              </S.ActionBtn>
              {path.length > 0 && (
                <S.ActionBtn $danger title="Remover condição" onClick={() => vm.removeNode(path)}>
                  <RiDeleteBinLine size={13} />
                </S.ActionBtn>
              )}
            </S.NodeActions>
          )}
        </S.Leaf>
      );
    }
  }
};

export const ConditionDiagram: React.FC<ConditionDiagramProps> = (props) => {
  const vm = useConditionDiagramViewModel(props);
  const { condition } = props;
  const showRootActions = vm.isInteractive && condition.kind !== 'LogicalAnd' && condition.kind !== 'LogicalOr';

  return (
    <S.Container>
      <DiagramNode condition={condition} vm={vm} path={[]} />
      {showRootActions && (
        <S.RootActions>
          <S.RootActionBtn onClick={() => vm.addComparison(null)} title="Adicionar comparação de campo">
            <RiAddLine size={14} />
            Condição
          </S.RootActionBtn>
          <S.RootActionBtn onClick={() => vm.addExpression(null)} title="Adicionar expressão pura">
            <RiFunctionLine size={14} />
            Expressão
          </S.RootActionBtn>
          <S.RootActionBtn onClick={() => vm.addGroup(null)} title="Adicionar grupo">
            <RiBracesLine size={14} />
            Grupo
          </S.RootActionBtn>
        </S.RootActions>
      )}
    </S.Container>
  );
};
