import { Button, EntityListModals, Icon, InfoBanner, cardActionIcon } from '@microteia/ui';
import type { RecordTabProps } from '@microteia/data';
import { useTimelineViewModel } from './Timeline.viewmodel';
import { S } from './Timeline.styles';

/**
 * A tab inside a Project record, contributed by `surfaceTab({ surface: recordSurface(...) }, 'timeline')`.
 * The host renders it with `RecordTabProps`; this file only draws what the view model returns.
 *
 * The card actions are the screen's own (Form Design decides which), so "delete" here is whatever the
 * office configured for Milestones — and `EntityListModals` asks for the confirmation.
 */
export default function TimelineTab(props: RecordTabProps) {
  const vm = useTimelineViewModel(props);

  if (vm.screenMissing) {
    return <InfoBanner message={vm.t('timeline.screen-missing')} variant="warning" />;
  }

  return (
    <S.Wrapper>
      {vm.canCreate && (
        <S.Toolbar>
          <Button size="sm" onClick={vm.list.openNewRecord}>{vm.t('timeline.new')}</Button>
        </S.Toolbar>
      )}

      {vm.items.length === 0 ? (
        <S.Empty>{vm.t('timeline.empty')}</S.Empty>
      ) : (
        <S.Line>
          {vm.items.map((item) => (
            <S.Item key={item.id}>
              <S.Dot $color={item.color} />
              <S.Body $done={item.done} onClick={() => vm.list.openRecord(item.record)}>
                <S.Title $done={item.done}>{item.title}</S.Title>
                <S.When>{item.when}</S.When>
              </S.Body>
              <S.Actions>
                {vm.canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title={vm.t(item.done ? 'timeline.reopen' : 'timeline.complete')}
                    onClick={() => vm.toggleDone(item.record)}
                  >
                    <Icon name={item.done ? 'history' : 'check'} size={14} />
                  </Button>
                )}
                {item.actions.map((action) => (
                  <Button key={action.key} variant="ghost" size="sm" title={action.title} disabled={action.disabled} onClick={action.onClick}>
                    {action.active === undefined
                      ? cardActionIcon(action, 14)
                      : <S.ToggleIcon $on={action.active}>{cardActionIcon(action, 14)}</S.ToggleIcon>}
                  </Button>
                ))}
              </S.Actions>
            </S.Item>
          ))}
        </S.Line>
      )}

      <EntityListModals vm={vm.list} />
    </S.Wrapper>
  );
}
