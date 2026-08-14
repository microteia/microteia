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
import { useT } from '../../../shared/i18n/useT';

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
  const t = useT('core.ui');

  if (node.type === 'group') {
    const collapsed = vm.isCollapsed(node.id);
    return (
      <S.GroupCard $operator={node.operator} id={`condition-node-${node.id}`} $focused={vm.focusedNodeId === node.id}>
        <S.GroupHeader>
          <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? t('condition.group.expand') : t('condition.group.collapse')}>
            {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
          </S.CollapseBtn>
          <S.OperatorToggle>
            <S.OperatorBtn $active={node.operator === 'and'} onClick={() => vm.setGroupOperator(node.id, 'and')} title={t('condition.operator.and.title')}>
              {t('condition.operator.and')}
            </S.OperatorBtn>
            <S.OperatorBtn $active={node.operator === 'or'} onClick={() => vm.setGroupOperator(node.id, 'or')} title={t('condition.operator.or.title')}>
              {t('condition.operator.or')}
            </S.OperatorBtn>
          </S.OperatorToggle>
          {!isRoot && (
            <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title={t('condition.group.invert')}>
              {t('condition.not')}
            </S.NegateBtn>
          )}
          {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
          <S.GroupActions>
            <S.GroupActionBtn onClick={() => vm.addComparison(node.id)} title={t('condition.root.add-comparison')}>
              <RiAddLine size={14} />
              {t('condition.label.condition')}
            </S.GroupActionBtn>
            <S.GroupActionBtn onClick={() => vm.addExpression(node.id)} title={t('condition.root.add-expression')}>
              <RiFunctionLine size={14} />
              {t('condition.label.expression')}
            </S.GroupActionBtn>
            <S.GroupActionBtn onClick={() => vm.addGroup(node.id)} title={t('condition.add.group.nested')}>
              <RiBracesLine size={14} />
              {t('condition.label.group')}
            </S.GroupActionBtn>
            {node.children.length > 1 && (
              <S.GroupActionBtn
                onClick={() => vm.wrapGroupChildren(node.id)}
                title={t('condition.group.wrap.hint')}
              >
                <RiParenthesesLine size={14} />
                {t('condition.label.wrap')}
              </S.GroupActionBtn>
            )}
            {!isRoot && (
              <S.RemoveButton onClick={() => vm.removeNode(node.id)} title={t('condition.remove.group')}>
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
                  <S.JoinPill $operator={node.operator}>{node.operator === 'and' ? t('condition.operator.and') : t('condition.operator.or')}</S.JoinPill>
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
          <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? t('condition.expand') : t('condition.collapse')}>
            {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
          </S.CollapseBtn>
          <S.ConditionLabel>{t('condition.label.expression')}</S.ConditionLabel>
          {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
          <S.HeaderActions>
            <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title={t('condition.invert')}>
              {t('condition.not')}
            </S.NegateBtn>
            <S.RemoveButton onClick={() => vm.removeNode(node.id)} title={t('condition.remove.expression')}>
              <RiDeleteBinLine size={14} />
            </S.RemoveButton>
          </S.HeaderActions>
        </S.ConditionHeader>
        {!collapsed && (
          <>
            <ExpressionEditor
              value={node.expression}
              onChange={(expression) => vm.updateExpression(node.id, expression)}
              placeholder={t('condition.expression.placeholder')}
              eventFields={vm.eventFields}
              pathRoot={vm.pathRoot}
              stepOutputFields={vm.stepOutputFields}
              workflowVariables={vm.workflowVariables}
              inputRoot={vm.inputRoot}
            />
            <S.HelpText>{t('condition.expression.help')}</S.HelpText>
          </>
        )}
      </S.ConditionCard>
    );
  }

  const collapsed = vm.isCollapsed(node.id);
  return (
    <S.ConditionCard id={`condition-node-${node.id}`} $focused={vm.focusedNodeId === node.id}>
      <S.ConditionHeader>
        <S.CollapseBtn onClick={() => vm.toggleCollapsed(node.id)} title={collapsed ? t('condition.expand') : t('condition.collapse')}>
          {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
        </S.CollapseBtn>
        <S.ConditionLabel>{t('condition.label.comparison')}</S.ConditionLabel>
        {collapsed && <S.CollapsedSummary>{vm.getNodeSummary(node)}</S.CollapsedSummary>}
        <S.HeaderActions>
          <S.NegateBtn $active={node.negated} onClick={() => vm.toggleNegated(node.id)} title={t('condition.invert')}>
            {t('condition.not')}
          </S.NegateBtn>
          <S.RemoveButton onClick={() => vm.removeNode(node.id)} title={t('condition.remove')}>
            <RiDeleteBinLine size={14} />
          </S.RemoveButton>
        </S.HeaderActions>
      </S.ConditionHeader>

      {collapsed ? null : (<>
      <S.ConditionRow>
        <S.FieldGroup>
          <S.Label>{t('condition.field')}</S.Label>
          <SearchSelect
            options={vm.fieldOptions}
            value={node.fieldPath}
            onChange={(path) => vm.updateComparison(node.id, { fieldPath: path })}
            placeholder={t('condition.field.placeholder')}
          />
        </S.FieldGroup>

        <S.FieldGroup>
          <S.Label>{t('condition.operator')}</S.Label>
          <SearchSelect
            options={vm.operatorOptions}
            value={node.operator}
            onChange={(op) => vm.updateComparison(node.id, { operator: op as typeof node.operator })}
            placeholder={t('select.placeholder')}
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
                { label: t('condition.value-type.literal'), value: 'literal' },
                { label: t('condition.label.expression'), value: 'expression' },
                { label: t('condition.value-type.event-field'), value: 'eventField' },
              ]}
            />
          </S.ValueTypeRow>

          <S.FieldGroup>
            <S.Label>{t('condition.value')}</S.Label>
            {node.valueType === 'literal' && (() => {
              const lookupOptions = vm.getLookupValueOptions(node.fieldPath);
              return lookupOptions ? (
                <SearchSelect
                  options={lookupOptions}
                  value={node.value}
                  onChange={(value) => vm.updateComparison(node.id, { value })}
                  placeholder={t('condition.value.placeholder')}
                />
              ) : (
                <Input
                  value={node.value}
                  onChange={(e) => vm.updateComparison(node.id, { value: e.target.value })}
                  placeholder={t('condition.value.literal.placeholder')}
                />
              );
            })()}
            {node.valueType === 'expression' && (
              <ExpressionEditor
                value={node.value}
                onChange={(value) => vm.updateComparison(node.id, { value })}
                placeholder={t('condition.value.expression.placeholder')}
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
                placeholder={t('condition.field.placeholder')}
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
  const t = useT('core.ui');

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>{t('condition.when.title')}</S.SectionTitle>

        <RadioGroup
          name="execution-mode"
          value={vm.mode}
          onChange={(mode) => vm.setMode(mode as 'always' | 'custom')}
          options={[
            { label: t('condition.when.always'), value: 'always' },
            { label: t('condition.when.custom'), value: 'custom' },
          ]}
        />
      </S.Section>

      {vm.mode === 'custom' && (
        <S.Section>
          <ConditionNode node={vm.root} vm={vm} isRoot />
          <S.HelpText>{t('condition.help')}</S.HelpText>
        </S.Section>
      )}
    </S.Container>
  );
};
