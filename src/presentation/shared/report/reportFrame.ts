import { createContext, useContext } from 'react';
import type { ReportDefinition } from '../../../domain/entities/Report';
import type { ReportResult } from '../../../domain/schema/report/reportResult';

/**
 * O que a MOLDURA da aba do relatório entrega à view que desenha o corpo dele (`reports[].view`).
 *
 * Quem executa é a moldura, e não a view: é isso que faz Exportar, Imprimir e Assinar agirem sobre o
 * mesmo resultado e as mesmas respostas que a view mostra. Uma view que buscasse os números por conta
 * própria (`useReport`) teria uma tela e outra exportação.
 */
export interface ReportFrame {
  report: ReportDefinition;
  result: ReportResult | null;
  isLoading: boolean;
  /** As respostas com que o relatório foi executado por último — as que a assinatura repete. */
  prompts: Readonly<Record<string, unknown>>;
  /** Executa de novo com estas respostas aos filtros, pela chave de cada um. */
  run: (prompts?: Record<string, unknown>) => Promise<void>;
}

export const ReportFrameContext = createContext<ReportFrame | null>(null);

/** A moldura da aba do relatório, ou `null` fora dela — a mesma view pode servir de página comum. */
export const useReportFrame = (): ReportFrame | null => useContext(ReportFrameContext);
