import { Button, ConfirmModal, InfoBanner, Input, Spinner } from '@microteia/ui';
import { useBusinessDaysViewModel } from './BusinessDays.viewmodel';
import { S } from './BusinessDays.styles';

/**
 * The business-day calendars, in four files: this one renders, `BusinessDays.viewmodel.tsx` holds the
 * draft and the gestures, `BusinessDays.styles.tsx` holds the styles and `BusinessDays.rules.ts` holds
 * what a test can call.
 *
 * On the left, the calendars. On the right, the selected one: its name and key, the weekdays that are
 * never business days, its years, and the twelve months of the chosen year — click a day to mark it,
 * drag across a period to mark it all.
 */
export default function BusinessDaysView() {
  const vm = useBusinessDaysViewModel();

  if (vm.screenMissing) {
    return (
      <S.Missing>
        <InfoBanner message={vm.t('view.screen-missing')} variant="warning" />
      </S.Missing>
    );
  }

  if (vm.isLoading) return <Spinner />;

  return (
    <S.Layout>
      <S.Panel>
        <S.PanelTitle>{vm.t('view.calendars')}</S.PanelTitle>
        {vm.calendars.length === 0 ? <S.Muted>{vm.t('view.empty')}</S.Muted> : null}
        <S.CalendarList>
          {vm.calendars.map((calendar) => (
            <S.CalendarItem
              key={calendar.id}
              type="button"
              $active={calendar.id === vm.activeId}
              onClick={() => vm.selectCalendar(calendar.id)}
            >
              <S.CalendarName>{calendar.name}</S.CalendarName>
              <S.CalendarKey>{calendar.key}</S.CalendarKey>
            </S.CalendarItem>
          ))}
        </S.CalendarList>
        {vm.canCreate ? (
          <Button variant="secondary" size="sm" onClick={vm.createCalendar}>
            {vm.t('view.new-calendar')}
          </Button>
        ) : null}
      </S.Panel>

      {vm.hasCalendar ? (
        <S.Panel>
          <S.FieldRow>
            <S.Field>
              {vm.t('view.name')}
              <Input value={vm.draft.name} disabled={!vm.canEdit} onChange={(event) => vm.setName(event.target.value)} />
            </S.Field>
            <S.Field>
              {vm.t('view.key')}
              <Input value={vm.draft.key} disabled={!vm.canEdit} onChange={(event) => vm.setKey(event.target.value)} />
              <S.Hint>{vm.t('view.key.hint')}</S.Hint>
            </S.Field>
          </S.FieldRow>

          <S.Row>
            <S.RowLabel>{vm.t('view.weekend')}</S.RowLabel>
            {vm.weekdayNames.map((name, weekday) => (
              <S.Chip
                key={name}
                type="button"
                $active={vm.draft.weekend.includes(weekday)}
                disabled={!vm.canEdit}
                onClick={() => vm.toggleWeekday(weekday)}
              >
                {name}
              </S.Chip>
            ))}
          </S.Row>

          <S.Row>
            <S.RowLabel>{vm.t('view.years')}</S.RowLabel>
            {vm.years.map((year) => (
              <S.Chip key={year} type="button" $active={year === vm.activeYear} onClick={() => vm.selectYear(year)}>
                {year}
              </S.Chip>
            ))}
            {vm.canEdit ? (
              <S.Chip type="button" onClick={vm.addYear}>
                {vm.t('view.add-year', { year: vm.yearToAdd })}
              </S.Chip>
            ) : null}
            {vm.canEdit && vm.canCopy ? (
              <S.Chip type="button" onClick={vm.copyToNextYear}>
                {vm.t('view.copy-year', { year: vm.copyTarget })}
              </S.Chip>
            ) : null}
            {vm.canEdit && vm.activeYear ? (
              <S.Chip type="button" onClick={() => vm.askRemoveYear(vm.activeYear ?? '')}>
                {vm.t('view.remove-year', { year: vm.activeYear })}
              </S.Chip>
            ) : null}
          </S.Row>

          {vm.activeYear ? (
            <>
              <S.Row>
                <S.Muted>{vm.t('view.marked', { count: vm.markedCount, year: vm.activeYear })}</S.Muted>
                <S.Spacer />
                <S.LegendItem>
                  <S.LegendSwatch $state="off" />
                  {vm.t('view.legend.off')}
                </S.LegendItem>
                <S.LegendItem>
                  <S.LegendSwatch $state="weekend" />
                  {vm.t('view.legend.weekend')}
                </S.LegendItem>
              </S.Row>
              <S.Months>
                {vm.months.map((month) => (
                  <S.Month key={month.month}>
                    <S.MonthName>{month.name}</S.MonthName>
                    <S.Week>
                      {vm.weekdayInitials.map((initial, index) => (
                        <S.WeekdayHead key={index}>{initial}</S.WeekdayHead>
                      ))}
                    </S.Week>
                    {month.rows.map((row, rowIndex) => (
                      <S.Week key={rowIndex}>
                        {row.map((cell, cellIndex) =>
                          cell ? (
                            <S.Day
                              key={cell.day}
                              type="button"
                              $state={cell.state}
                              $editable={vm.canEdit}
                              onPointerDown={() => vm.onDayDown(cell)}
                              onPointerEnter={() => vm.onDayEnter(cell)}
                            >
                              {cell.label}
                            </S.Day>
                          ) : (
                            <S.EmptyDay key={cellIndex} />
                          ),
                        )}
                      </S.Week>
                    ))}
                  </S.Month>
                ))}
              </S.Months>
            </>
          ) : (
            <InfoBanner message={vm.t('view.no-years')} variant="info" />
          )}

          <S.Row>
            {vm.canDelete ? (
              <Button variant="ghost" size="sm" onClick={vm.askDelete}>
                {vm.t('view.delete')}
              </Button>
            ) : null}
            <S.Spacer />
            {vm.isDirty ? (
              <Button variant="ghost" size="sm" onClick={vm.discard}>
                {vm.t('view.discard')}
              </Button>
            ) : null}
            {vm.canEdit ? (
              <Button variant="primary" size="sm" disabled={!vm.isDirty} $isLoading={vm.saving} onClick={vm.save}>
                {vm.t('view.save')}
              </Button>
            ) : null}
          </S.Row>
        </S.Panel>
      ) : (
        <S.Panel>
          <S.Muted>{vm.t('view.select')}</S.Muted>
        </S.Panel>
      )}

      <ConfirmModal
        isOpen={vm.confirmation !== null}
        title={vm.confirmTitle}
        message={vm.confirmMessage}
        confirmLabel={vm.confirmLabel}
        cancelLabel={vm.t('view.cancel')}
        variant="danger"
        onConfirm={vm.confirm}
        onCancel={vm.cancelConfirmation}
      />
    </S.Layout>
  );
}
