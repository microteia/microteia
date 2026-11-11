import React from 'react';
import { RiCheckboxCircleLine, RiExternalLinkLine } from 'react-icons/ri';
import { S } from './WorkflowTasks.styles';
import { useWorkflowTasksViewModel } from './WorkflowTasks.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { InfoBanner } from '../../components/ui/InfoBanner';

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
            <S.Meta $overdue={task.overdue}>
              <span>{task.createdAt}</span>
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
            </S.Actions>
          </S.Card>
        ))}
      </S.List>
    </S.Page>
  );
};
