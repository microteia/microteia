import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCan, useCreateRecord, useDeleteRecord, useEntity, useNotify, useUpdateRecord } from '@microteia/data';
import { useLocale, useT } from '@microteia/i18n';
import {
  copyYear,
  draftOf,
  freeKey,
  isKeyTaken,
  isValidKey,
  monthGridOf,
  monthNameOf,
  sameDraft,
  weekdayNamesOf,
  weekdayOf,
  withDay,
  withWeekday,
  withYear,
  withoutYear,
  yearsOf,
  type CalendarDraft,
} from './BusinessDays.rules';

const SOURCE_ID = 'microteia:business-calendars';

type DayState = 'off' | 'weekend' | 'business';

interface DayCell {
  day: string;
  label: number;
  state: DayState;
}

interface MonthView {
  month: number;
  name: string;
  rows: (DayCell | null)[][];
}

type Confirmation = { kind: 'delete' } | { kind: 'remove-year'; year: string } | null;

/**
 * The state, the data and the gestures — and no JSX.
 *
 * What the grid edits is a DRAFT per calendar, kept apart from the stored record: marking days is a
 * dozen clicks, and saving each one would hand the formulas a calendar that is half marked. The draft
 * is derived — the stored record unless the person changed something — so nothing has to be copied
 * into state by an effect.
 */
export const useBusinessDaysViewModel = () => {
  const t = useT('com.microteia.business-days');
  const { locale } = useLocale();
  const entity = useEntity(SOURCE_ID);
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const notify = useNotify();
  const can = useCan();

  const collection = entity.collection;
  const records = entity.records;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, CalendarDraft>>({});
  const [yearChoice, setYearChoice] = useState<string | null>(null);
  const [painting, setPainting] = useState<boolean | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [saving, setSaving] = useState(false);
  const [currentYear] = useState(() => new Date().getFullYear());

  const calendars = useMemo(
    () =>
      records
        .map((record) => ({ id: record.id as string, name: String(record.name || record.key || record.id), key: String(record.key ?? '') }))
        .sort((left, right) => left.name.localeCompare(right.name, locale)),
    [records, locale],
  );

  const activeId = selectedId && calendars.some((calendar) => calendar.id === selectedId)
    ? selectedId
    : calendars[0]?.id ?? null;
  const record = useMemo(() => records.find((item) => item.id === activeId) ?? null, [records, activeId]);
  const stored = useMemo(() => draftOf(record), [record]);
  const pending = activeId ? edits[activeId] : undefined;
  const draft = pending ?? stored;
  const isDirty = !!pending && !sameDraft(pending, stored);

  const years = yearsOf(draft);
  const activeYear =
    yearChoice && draft.years[yearChoice]
      ? yearChoice
      : years.includes(String(currentYear))
        ? String(currentYear)
        : years[years.length - 1] ?? null;

  const canEdit = !!collection && can(`${collection}.update`);
  const canCreate = !!collection && can(`${collection}.create`);
  const canDelete = !!collection && can(`${collection}.delete`);

  const weekdayNames = useMemo(() => weekdayNamesOf(locale, 'short'), [locale]);
  const weekdayInitials = useMemo(() => weekdayNamesOf(locale, 'narrow'), [locale]);

  const months = useMemo((): MonthView[] => {
    if (!activeYear) return [];
    const year = Number(activeYear);
    const marked = new Set(draft.years[activeYear] ?? []);
    const weekend = new Set(draft.weekend);
    return Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      name: monthNameOf(locale, year, index + 1),
      rows: monthGridOf(year, index + 1).map((row) =>
        row.map((day) => {
          if (!day) return null;
          const state: DayState = marked.has(day) ? 'off' : weekend.has(weekdayOf(day)) ? 'weekend' : 'business';
          return { day, label: Number(day.slice(8)), state };
        }),
      ),
    }));
  }, [activeYear, draft, locale]);

  const markedCount = activeYear ? (draft.years[activeYear] ?? []).length : 0;
  const lastYear = years[years.length - 1];
  const yearToAdd = lastYear ? Number(lastYear) + 1 : currentYear;
  const copyTarget = activeYear ? String(Number(activeYear) + 1) : null;
  const canCopy = !!copyTarget && !draft.years[copyTarget];

  const edit = useCallback(
    (change: (current: CalendarDraft) => CalendarDraft) => {
      if (!activeId) return;
      setEdits((previous) => ({ ...previous, [activeId]: change(previous[activeId] ?? stored) }));
    },
    [activeId, stored],
  );

  useEffect(() => {
    const stop = () => setPainting(null);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const onDayDown = useCallback(
    (cell: DayCell) => {
      if (!canEdit || cell.state === 'weekend') return;
      const mark = cell.state !== 'off';
      edit((current) => withDay(current, cell.day, mark));
      setPainting(mark);
    },
    [canEdit, edit],
  );

  const onDayEnter = useCallback(
    (cell: DayCell) => {
      if (painting === null || cell.state === 'weekend') return;
      edit((current) => withDay(current, cell.day, painting));
    },
    [painting, edit],
  );

  const toggleWeekday = useCallback(
    (weekday: number) => {
      if (!canEdit) return;
      edit((current) => withWeekday(current, weekday, !current.weekend.includes(weekday)));
    },
    [canEdit, edit],
  );

  const setName = useCallback((name: string) => edit((current) => ({ ...current, name })), [edit]);
  const setKey = useCallback((key: string) => edit((current) => ({ ...current, key })), [edit]);

  const selectCalendar = useCallback((id: string) => {
    setSelectedId(id);
    setYearChoice(null);
  }, []);

  const addYear = useCallback(() => {
    edit((current) => withYear(current, yearToAdd));
    setYearChoice(String(yearToAdd));
  }, [edit, yearToAdd]);

  const copyToNextYear = useCallback(() => {
    if (!activeYear || !copyTarget) return;
    edit((current) => copyYear(current, activeYear, copyTarget));
    setYearChoice(copyTarget);
    notify(t('view.copy-year.done', { from: activeYear, to: copyTarget }), 'info');
  }, [activeYear, copyTarget, edit, notify, t]);

  const discard = useCallback(() => {
    if (!activeId) return;
    setEdits((previous) => {
      const next = { ...previous };
      delete next[activeId];
      return next;
    });
  }, [activeId]);

  const otherKeys = useCallback(
    (id: string | null) => calendars.filter((calendar) => calendar.id !== id).map((calendar) => calendar.key),
    [calendars],
  );

  const save = useCallback(async () => {
    if (!collection || !activeId) return;
    const key = draft.key.trim();
    if (!isValidKey(key)) {
      notify(t('view.key.invalid'), 'error');
      return;
    }
    if (isKeyTaken(key, otherKeys(activeId))) {
      notify(t('view.key.taken', { key }), 'error');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(collection, activeId, {
        name: draft.name.trim(),
        key,
        weekend: draft.weekend,
        years: draft.years,
      });
      discard();
      notify(t('view.saved'), 'success');
    } catch {
      notify(t('view.failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [collection, activeId, draft, otherKeys, updateRecord, discard, notify, t]);

  const createCalendar = useCallback(async () => {
    if (!collection) return;
    const name = t('view.new-calendar.name');
    try {
      const created = await createRecord(collection, {
        name,
        key: freeKey(name, otherKeys(null)),
        weekend: [0, 6],
        years: { [String(currentYear)]: [] },
      });
      if (created?.id) selectCalendar(created.id);
    } catch {
      notify(t('view.failed'), 'error');
    }
  }, [collection, createRecord, currentYear, notify, otherKeys, selectCalendar, t]);

  const askDelete = useCallback(() => setConfirmation({ kind: 'delete' }), []);
  const askRemoveYear = useCallback((year: string) => setConfirmation({ kind: 'remove-year', year }), []);
  const cancelConfirmation = useCallback(() => setConfirmation(null), []);

  const confirm = useCallback(async () => {
    const current = confirmation;
    setConfirmation(null);
    if (!current) return;
    if (current.kind === 'remove-year') {
      edit((draftNow) => withoutYear(draftNow, current.year));
      setYearChoice(null);
      return;
    }
    if (!collection || !activeId) return;
    try {
      await deleteRecord(collection, activeId);
      discard();
      setSelectedId(null);
    } catch {
      notify(t('view.failed'), 'error');
    }
  }, [confirmation, edit, collection, activeId, deleteRecord, discard, notify, t]);

  const confirmTitle =
    confirmation?.kind === 'delete'
      ? t('view.delete.title', { name: draft.name || draft.key })
      : confirmation?.kind === 'remove-year'
        ? t('view.remove-year.title', { year: confirmation.year })
        : '';
  const confirmMessage =
    confirmation?.kind === 'delete'
      ? t('view.delete.message')
      : confirmation?.kind === 'remove-year'
        ? t('view.remove-year.message', { year: confirmation.year })
        : '';
  const confirmLabel = confirmation?.kind === 'delete' ? t('view.delete.confirm') : t('view.remove.confirm');

  return {
    t,
    isLoading: entity.isLoading,
    screenMissing: !entity.isLoading && !entity.screen,
    calendars,
    activeId,
    selectCalendar,
    hasCalendar: !!record,
    draft,
    isDirty,
    saving,
    canEdit,
    canCreate,
    canDelete,
    weekdayNames,
    weekdayInitials,
    years,
    activeYear,
    selectYear: setYearChoice,
    yearToAdd,
    copyTarget,
    canCopy,
    months,
    markedCount,
    onDayDown,
    onDayEnter,
    toggleWeekday,
    setName,
    setKey,
    addYear,
    copyToNextYear,
    save,
    discard,
    createCalendar,
    askDelete,
    askRemoveYear,
    confirmation,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    confirm,
    cancelConfirmation,
  };
};
