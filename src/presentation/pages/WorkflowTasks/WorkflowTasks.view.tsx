import React from 'react';
import { RiCheckboxCircleLine, RiExternalLinkLine, RiShareForwardLine } from 'react-icons/ri';
import { S } from './WorkflowTasks.styles';
import { useWorkflowTasksViewModel } from './WorkflowTasks.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { SearchSelect } from '../../components/ui/SearchSelect';

/** A caixa de tarefas: o que as automações pediram a quem está logado, com um botão por desfecho. */
export const WorkflowTasksView: React.FC = () => {
  const vm = useWorkflowTasksViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderIcon>
          <RiCheckboxCircleLine size={22} />
        </S.HeaderIcon>
        <div>
          <S.Title>{vm.title}</S.Title>
          <S.Subtitle>{vm.subtitle}</S.Subtitle>
        </div>
      </S.Header>

      {vm.error && <InfoBanner message={vm.error} variant="warning" />}

      {!vm.isLoading && vm.tasks.length === 0 && <S.Empty>{vm.emptyMessage}</S.Empty>}

      <S.List>
        {vm.tasks.map((task) => (
          <S.Card key={task.id} $overdue={task.overdue}>
            <S.CardTitle>{task.title}</S.CardTitle>
            {task.message && <S.Message>{task.message}</S.Message>}
            {task.delegatedNote && <S.Message>{task.delegatedNote}</S.Message>}
            <S.Meta $overdue={task.overdue}>
              <span>{task.createdAt}</span>
              {task.progress && <span>{task.progress}</span>}
              {task.due && <span>{task.due}</span>}
            </S.Meta>
            <Input
              value={task.comment}
              placeholder={vm.commentPlaceholder}
              onChange={(event) => vm.setComment(task.id, event.target.value)}
              disabled={task.deciding}
            />
            <S.Actions>
              {task.outcomes.map((outcome) => (
                <Button
                  key={outcome.key}
                  variant="secondary"
                  size="sm"
                  disabled={task.deciding}
                  onClick={() => void vm.decide(task.id, outcome.key)}
                >
                  {outcome.label}
                </Button>
              ))}
              {task.hasRecord && (
                <Button variant="ghost" size="sm" onClick={() => vm.openRecord(task.id)} title={vm.openRecordLabel}>
                  <RiExternalLinkLine size={14} />
                </Button>
              )}
              {!task.delegating && (
                <Button variant="ghost" size="sm" disabled={task.deciding} onClick={() => vm.startDelegate(task.id)}>
                  <RiShareForwardLine size={14} />
                  {vm.delegateLabel}
                </Button>
              )}
            </S.Actions>
            {task.delegating && (
              <S.Delegate>
                <SearchSelect
                  label={vm.delegateToLabel}
                  options={vm.delegateOptions}
                  value={vm.delegateTo}
                  onChange={vm.setDelegateTo}
                />
                <Input
                  value={vm.delegateReason}
                  placeholder={vm.delegateReasonPlaceholder}
                  onChange={(event) => vm.setDelegateReason(event.target.value)}
                  disabled={task.deciding}
                />
                <S.Actions>
                  <Button size="sm" disabled={!vm.delegateTo || task.deciding} onClick={() => void vm.confirmDelegate()}>
                    {vm.delegateConfirmLabel}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={task.deciding} onClick={vm.cancelDelegate}>
                    {vm.cancelLabel}
                  </Button>
                </S.Actions>
              </S.Delegate>
            )}
          </S.Card>
        ))}
      </S.List>
    </S.Page>
  );
};
