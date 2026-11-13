import React from 'react';
import { S } from './PortalRecordTasks.styles';
import { usePortalRecordTasksViewModel, type PortalRecordTasksProps } from './PortalRecordTasks.viewmodel';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';

/** As aprovações que o escritório pediu ao convidado neste registro, com um botão por desfecho. */
export const PortalRecordTasks: React.FC<PortalRecordTasksProps> = (props) => {
  const vm = usePortalRecordTasksViewModel(props);
  if (vm.tasks.length === 0) return null;

  return (
    <S.List>
      <S.Heading>{vm.heading}</S.Heading>
      {vm.tasks.map((task) => (
        <S.Card key={task.id}>
          <S.Title>{task.title}</S.Title>
          {task.message && <S.Message>{task.message}</S.Message>}
          {(task.due || task.progress) && (
            <S.Meta>
              {task.progress && <span>{task.progress}</span>}
              {task.due && <span>{task.due}</span>}
            </S.Meta>
          )}
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
                size="sm"
                variant={outcome.primary ? 'primary' : 'secondary'}
                disabled={task.deciding}
                onClick={() => vm.decide(task.id, outcome.key)}
              >
                {outcome.label}
              </Button>
            ))}
          </S.Actions>
        </S.Card>
      ))}
    </S.List>
  );
};
