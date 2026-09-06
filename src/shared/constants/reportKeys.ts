/** O prefixo da aba que abre UM relatório. A chave é `prefixo + key`. */
export const REPORT_TAB_PREFIX = 'rep:';

export const buildReportTabKey = (reportKey: string): string => `${REPORT_TAB_PREFIX}${reportKey}`;

export const parseReportTabKey = (tabKey: string): string | null =>
  tabKey.startsWith(REPORT_TAB_PREFIX) ? tabKey.slice(REPORT_TAB_PREFIX.length) : null;

/** A aba da AUTORIA de um relatório que já existe. Sem sufixo, ela cria um novo. */
export const REPORT_DESIGN_TAB = 'report-design';

export const REPORT_DESIGN_TAB_PREFIX = 'report-design:';

export const buildReportDesignTabKey = (reportKey: string): string =>
  `${REPORT_DESIGN_TAB_PREFIX}${reportKey}`;

export const parseReportDesignTabKey = (tabKey: string): string | null =>
  tabKey.startsWith(REPORT_DESIGN_TAB_PREFIX)
    ? tabKey.slice(REPORT_DESIGN_TAB_PREFIX.length)
    : null;
