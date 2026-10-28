import { useMemo } from 'react';
import { useLookups } from '../../stores/useLookups';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useTenant } from '../../stores/useTenant';
import { useLabel, useT } from '../shared/i18n/useT';
import { buildReferenceOptions } from './buildReferenceOptions';
import type { ReferenceOption } from './buildReferenceOptions';

export type { ReferenceOption };

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const t = useT('core.records');
  const label = useLabel();
  const { getOptions } = useLookups();
  const { recordsByCollection } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();
  const { members } = useTenant();

  return useMemo(
    () => buildReferenceOptions({
      recordsByCollection,
      dynamicScreens,
      members,
      getOptions,
      label,
      untitled: t('record.untitled'),
    }),
    [recordsByCollection, dynamicScreens, members, getOptions, label, t],
  );
};
