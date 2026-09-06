import React from 'react';
import { S } from './ViewReport.styles';
import { useViewReportViewModel } from './ViewReport.viewmodel';
import { ReportView } from '../../components/ui/ReportView';

/** A aba de UM relatório. A chave dele vem no nome da aba (`rep:<key>`). */
export const ViewReportView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewReportViewModel(tabKey);

  return (
    <S.Page>
      <ReportView reportKey={vm.reportKey} tabKey={tabKey} />
    </S.Page>
  );
};
