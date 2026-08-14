import React from 'react';
import { RiCheckDoubleLine, RiFunctionLine, RiAddLine, RiBracesLine, RiEditLine, RiDeleteBinLine, RiParenthesesLine, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import { S } from './ConditionDiagram.styles';
import { useConditionDiagramViewModel } from './ConditionDiagram.viewmodel';
import type { ConditionDiagramProps, ConditionDiagramViewModel, ConditionPath } from './ConditionDiagram.viewmodel';
import type { Condition } from '../../../../domain/entities/Workflow';
import { useT } from '../../../shared/i18n/useT';

const DiagramNode: React.FC<{
  condition: Condition;
  vm: ConditionDiagramViewModel;
  path: ConditionPath;
  parentIsNot?: boolean;
}> = ({ condition, vm, path, parentIsNot = false }) => {
  const t = useT('core.ui');

  switch (condition.kind) {
    case 'AlwaysTrue':
      return (
        <S.AlwaysPill>
          <RiCheckDoubleLine size={16} />
          {t('condition.always')}
        </S.AlwaysPill>
      );

    case 'Not':
      return (
        <S.NotWrapper>
          <S.NotBadge
            onClick={() => vm.toggleNegated(path)}
            disabled={!vm.isInteractive}
            title={t('condition.negation.remove')}
          >
            {t('condition.not')}
          </S.NotBadge>
          <DiagramNode condition={condition.condition} vm={vm} path={[...path, 0]} parentIsNot />
        </S.NotWrapper>
      );

    case 'LogicalAnd':
    case 'LogicalOr': {
      const operator = condition.kind === 'LogicalAnd' ? 'and' : 'or';
      const joinLabel = operator === 'and' ? t('condition.join.and') : t('condition.join.or');
      const collapsed = vm.isCollapsed(path);
      const childCount = condition.conditions.length;
      return (
        <S.Group $operator={operator}>
          <S.GroupHeader>
            <S.CollapseBtn onClick={() => vm.toggleCollapsed(path)} title={collapsed ? t('condition.group.expand') : t('condition.group.collapse')}>
              {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
            </S.CollapseBtn>
            <S.GroupBadge
              $operator={operator}
              onClick={() => vm.toggleGroupOperator(path)}
              disabled={!vm.isInteractive}
              title={t('condition.group.toggle-operator')}
            >
              {operator === 'and' ? t('condition.group.all') : t('condition.group.any')}
            </S.GroupBadge>
            {collapsed && (
              <S.EmptyHint>{t('condition.hidden', { count: childCount })}</S.EmptyHint>
            )}
            {vm.isInteractive && (
              <S.NodeActions>
                <S.ActionBtn title={t('condition.add.comparison')} onClick={() => vm.addComparison(path)}>
                  <RiAddLine size={13} />
                </S.ActionBtn>
                <S.ActionBtn title={t('condition.add.expression')} onClick={() => vm.addExpression(path)}>
                  <RiFunctionLine size={13} />
                </S.ActionBtn>
                <S.ActionBtn title={t('condition.add.group')} onClick={() => vm.addGroup(path)}>
                  <RiBracesLine size={13} />
                </S.ActionBtn>
                {condition.conditions.length > 1 && (
                  <S.ActionBtn
                    title={t('condition.group.wrap')}
                    onClick={() => vm.wrapGroupChildren(path)}
                  >
                    <RiParenthesesLine size={13} />
                  </S.ActionBtn>
                )}
                {!parentIsNot && (
                  <S.ActionBtn title={t('condition.negate.group')} onClick={() => vm.toggleNegated(path)}>
                    {t('condition.not')}
                  </S.ActionBtn>
                )}
                {path.length > 0 && (
                  <S.ActionBtn $danger title={t('condition.remove.group')} onClick={() => vm.removeNode(path)}>
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
            {condition.expression || <S.EmptyHint>{t('condition.expression.empty')}</S.EmptyHint>}
          </S.ExpressionChip>
          {vm.isInteractive && (
            <S.NodeActions>
              {!parentIsNot && (
                <S.ActionBtn title={t('condition.negate')} onClick={() => vm.toggleNegated(path)}>{t('condition.not')}</S.ActionBtn>
              )}
              <S.ActionBtn title={t('condition.edit')} onClick={() => vm.requestEdit(path)}>
                <RiEditLine size={13} />
              </S.ActionBtn>
              {path.length > 0 && (
                <S.ActionBtn $danger title={t('condition.remove.expression')} onClick={() => vm.removeNode(path)}>
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
            : <S.EmptyHint>{t('condition.field.unset')}</S.EmptyHint>}
          <S.OperatorText>{vm.getOperatorLabel(condition.operator)}</S.OperatorText>
          {needsValue && condition.valueType === 'literal' && (
            String(condition.value ?? '') !== ''
              ? <S.ValueChip>{String(condition.value)}</S.ValueChip>
              : <S.EmptyHint>{t('condition.value.unset')}</S.EmptyHint>
          )}
          {needsValue && condition.valueType === 'expression' && (
            <S.ExpressionChip>
              <RiFunctionLine size={12} />
              {String(condition.value ?? '') || <S.EmptyHint>{t('condition.expression.empty')}</S.EmptyHint>}
            </S.ExpressionChip>
          )}
          {needsValue && condition.valueType === 'eventField' && (
            String(condition.value ?? '') !== ''
              ? <S.FieldChip>{vm.getFieldLabel(String(condition.value))}</S.FieldChip>
              : <S.EmptyHint>{t('condition.field.unset')}</S.EmptyHint>
          )}
          {vm.isInteractive && (
            <S.NodeActions>
              {!parentIsNot && (
                <S.ActionBtn title={t('condition.negate')} onClick={() => vm.toggleNegated(path)}>{t('condition.not')}</S.ActionBtn>
              )}
              <S.ActionBtn title={t('condition.edit')} onClick={() => vm.requestEdit(path)}>
                <RiEditLine size={13} />
              </S.ActionBtn>
              {path.length > 0 && (
                <S.ActionBtn $danger title={t('condition.remove')} onClick={() => vm.removeNode(path)}>
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
  const t = useT('core.ui');
  const { condition } = props;
  const showRootActions = vm.isInteractive && condition.kind !== 'LogicalAnd' && condition.kind !== 'LogicalOr';

  return (
    <S.Container>
      <DiagramNode condition={condition} vm={vm} path={[]} />
      {showRootActions && (
        <S.RootActions>
          <S.RootActionBtn onClick={() => vm.addComparison(null)} title={t('condition.root.add-comparison')}>
            <RiAddLine size={14} />
            {t('condition.label.condition')}
          </S.RootActionBtn>
          <S.RootActionBtn onClick={() => vm.addExpression(null)} title={t('condition.root.add-expression')}>
            <RiFunctionLine size={14} />
            {t('condition.label.expression')}
          </S.RootActionBtn>
          <S.RootActionBtn onClick={() => vm.addGroup(null)} title={t('condition.add.group')}>
            <RiBracesLine size={14} />
            {t('condition.label.group')}
          </S.RootActionBtn>
        </S.RootActions>
      )}
    </S.Container>
  );
};
