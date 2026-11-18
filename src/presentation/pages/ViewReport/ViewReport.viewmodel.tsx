import { useMemo } from 'react';
import { parseReportTabKey } from '../../../shared/constants/reportKeys';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import { useReportCodeView } from '../../shared/report/useReportCodeView';
import type { ExtensionPageComponent } from '../../shared/extensions/evaluateExtensionView';

export interface ViewReportViewModel {
  reportKey: string;
  /**
   * A view da extensão que desenha o corpo deste relatório, quando há e pode rodar. É AQUI, e só aqui,
   * que ela entra: toda porta para o relatório — a lista, o ⌘K, o link direto, o `rep:<chave>` de uma
   * notificação, a assinatura — abre esta aba.
   */
  body: ExtensionPageComponent | undefined;
}

export const useViewReportViewModel = (tabKey: string): ViewReportViewModel => {
  const reportKey = useMemo(() => parseReportTabKey(tabKey) ?? '', [tabKey]);
  const { getReport } = useReportDefinitions();
  return { reportKey, body: useReportCodeView(getReport(reportKey)) };
};
