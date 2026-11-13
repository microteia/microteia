import { useMemo } from 'react';
import { useSchemaContext } from '../useSchemaContext';
import { useOptionalReportDefinitions } from '../../../stores/useReportDefinitions';
import { reportSchemaOf } from '../../../domain/schema/report/reportSnapshot';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

/**
 * O esquema e a tabela com que o relatório é lido na tela — os de sempre, ou os da série de instantâneos
 * (`reportSchemaOf`). Quem rotula um grupo, formata uma célula ou oferece um campo pergunta AQUI, e não a
 * `spec.dataset.table`: na série, essa é a chave do relatório de origem, não uma coleção.
 */
export const useReportSchema = (spec: ReportSpec | null | undefined): { ctx: SchemaContext; table: string } => {
  const base = useSchemaContext();
  const reports = useOptionalReportDefinitions()?.reports;
  return useMemo(() => reportSchemaOf(spec, base, (reports ?? []).filter((report) => !report.ownerId)), [spec, base, reports]);
};
