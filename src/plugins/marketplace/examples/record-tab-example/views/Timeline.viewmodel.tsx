import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useEntityList, useUpdateRecord } from '@microteia/data';
import type { RecordTabProps } from '@microteia/data';
import { useLocaleFormat, useT } from '@microteia/i18n';
import { getConfigColor } from '@microteia/theme';

/**
 * The Milestone screen, by its UNIVERSAL id. The installed key may gain a suffix in the destination
 * office; the sourceId is the same everywhere — the same reason the tab itself is addressed by one.
 */
const MILESTONE_SOURCE_ID = 'microteia:record-tab-example:milestone';
/** The reference field that points a milestone at its project. */
const PROJECT_FIELD = 'project';
const PRIORITY_FIELD = 'priority';

const timeOf = (value: unknown): number => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

/**
 * Latest due date first. Declared OUTSIDE the component and handed to `useEntityList` as `sortRecords`,
 * so the order holds in `records` and `filteredRecords` alike — sorting by hand drifts the day someone
 * swaps the list being drawn.
 */
const byDueDateDesc = (a: { dueDate?: unknown }, b: { dueDate?: unknown }): number =>
  timeOf(b.dueDate) - timeOf(a.dueDate);

/**
 * Everything the timeline decides, so the view only draws. It receives the open record as props
 * (`RecordTabProps`) — the host hands it over, and hands it again when the record changes.
 */
export const useTimelineViewModel = ({ recordId }: RecordTabProps) => {
  const t = useT('com.microteia.record-tab-example');
  const { formatDate } = useLocaleFormat();
  const theme = useTheme();
  const updateRecord = useUpdateRecord();

  // `parent` is a LOCK, not a filter: the person cannot clear it, the card actions see
  // `surface: 'parentTab'`, and `openNewRecord()` opens the form with the project already filled in.
  const list = useEntityList(MILESTONE_SOURCE_ID, {
    parent: { fieldKey: PROJECT_FIELD, recordId },
    sortRecords: byDueDateDesc,
  });

  // The colours come from the field's own options, as the office configured them — not from here.
  const priorityOptions = useMemo(
    () => list.definition?.fields?.find((field: { key: string }) => field.key === PRIORITY_FIELD)?.options ?? [],
    [list.definition],
  );

  const items = useMemo(
    () => list.filteredRecords.map((record) => ({
      record,
      id: record.id as string,
      title: list.getCardTitle(record),
      when: record.dueDate ? formatDate(record.dueDate) : t('timeline.no-date'),
      color: getConfigColor(priorityOptions, String(record[PRIORITY_FIELD] ?? ''), theme, theme.colors.textSecondary),
      done: record.done === true,
      actions: list.getCardActions(record),
    })),
    [list, priorityOptions, formatDate, theme, t],
  );

  const toggleDone = useCallback(
    (record: { id: string; done?: boolean }) =>
      updateRecord(list.collection, record.id, { done: record.done !== true }),
    [updateRecord, list.collection],
  );

  return {
    t,
    list,
    items,
    toggleDone,
    screenMissing: !list.isLoading && !list.definition,
    canUpdate: list.canUpdate,
    canCreate: list.canCreate,
  };
};
