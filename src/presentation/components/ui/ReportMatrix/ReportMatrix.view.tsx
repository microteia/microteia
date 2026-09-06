import React from 'react';
import { S } from './ReportMatrix.styles';
import { useReportMatrixViewModel } from './ReportMatrix.viewmodel';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export interface ReportMatrixProps {
  spec: ReportSpec;
  result: ReportResult | null;
}

/**
 * O PIVÔ — a dobra `matrix`.
 *
 * Duas faixas de cabeçalho: a de cima nomeia cada coluna do cruzamento, a de baixo nomeia as
 * medidas dentro dela. A coluna de grupos fica fixa à esquerda porque um pivô largo rola na
 * horizontal, e um rótulo que sai de vista transforma a tabela em números sem assunto.
 */
export const ReportMatrix: React.FC<ReportMatrixProps> = ({ spec, result }) => {
  const vm = useReportMatrixViewModel(spec, result);
  const manyMeasures = vm.measures.length > 1;

  return (
    <S.Scroll>
      <S.Table>
        <S.Head>
          <tr>
            <S.CornerTh rowSpan={manyMeasures ? 2 : 1}>{vm.corner}</S.CornerTh>
            {vm.columns.map((column) => (
              <S.ColumnTh key={column.key} colSpan={vm.measures.length}>{column.label}</S.ColumnTh>
            ))}
          </tr>
          {manyMeasures && (
            <tr>
              {vm.columns.flatMap((column) => vm.measures.map((measure) => (
                <S.MeasureTh key={`${column.key}:${measure.key}`}>{measure.label}</S.MeasureTh>
              )))}
            </tr>
          )}
        </S.Head>
        <tbody>
          {vm.rows.map((row) => (
            <S.Row key={row.id} $subtotal={row.subtotal}>
              <S.RowTh scope="row" $level={row.level} $strong={row.subtotal}>{row.group}</S.RowTh>
              {row.cells.map((cell, index) => (
                <S.Td key={index} $strong={row.subtotal}>{cell}</S.Td>
              ))}
            </S.Row>
          ))}
        </tbody>
        {vm.totals && !vm.isEmpty && (
          <tfoot>
            <S.TotalRow>
              <S.TotalTh scope="row">{vm.totals.label}</S.TotalTh>
              {vm.totals.cells.map((cell, index) => (
                <S.TotalTd key={index}>{cell}</S.TotalTd>
              ))}
            </S.TotalRow>
          </tfoot>
        )}
      </S.Table>
      {vm.isEmpty && <S.Empty>{vm.emptyMessage}</S.Empty>}
    </S.Scroll>
  );
};
