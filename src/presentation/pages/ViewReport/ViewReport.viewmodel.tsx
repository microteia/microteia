import { useMemo } from 'react';
import { parseReportTabKey } from '../../../shared/constants/reportKeys';

export interface ViewReportViewModel {
  reportKey: string;
}

export const useViewReportViewModel = (tabKey: string): ViewReportViewModel => ({
  reportKey: useMemo(() => parseReportTabKey(tabKey) ?? '', [tabKey]),
});
