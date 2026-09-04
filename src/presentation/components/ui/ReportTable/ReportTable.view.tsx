import React from 'react';
import { S } from './ReportTable.styles';
import { useReportTableViewModel } from './ReportTable.viewmodel';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export interface ReportTableProps {
  spec: ReportSpec;
  result: ReportResult | null;
}

/**
 * A tabela AGRUPADA — a dobra `summary`.
 *
 * Não sabe o que desenha: recebe o resultado agregado e os rótulos já resolvidos. Os níveis
 * aparecem pelo recuo, e o subtotal é uma linha como as outras, só marcada.
 */
export const ReportTable: React.FC<ReportTableProps> = ({ spec, result }) => {
  const vm = useReportTableViewModel(spec, result);

  return (
    <S.Scroll>
      <S.Table>
        <S.Head>
          <tr>
            {vm.columns.map((column) => (
              <S.Th key={column.key} $numeric={column.numeric}>{column.label}</S.Th>
            ))}
          </tr>
        </S.Head>
        <tbody>
          {vm.rows.map((row) => (
            <S.Row key={row.id} $subtotal={row.subtotal}>
              {vm.grouped && (
                <S.Td $level={row.level} $strong={row.subtotal}>{row.group}</S.Td>
              )}
              {row.values.map((value, index) => (
                <S.Td
                  key={vm.valueColumns[index].key}
                  $numeric={vm.valueColumns[index].numeric}
                  $strong={row.subtotal}
                >
                  {value}
                </S.Td>
              ))}
            </S.Row>
          ))}
        </tbody>
        {!vm.isEmpty && (vm.totals || vm.totalsInline) && (
          <tfoot>
            <S.TotalRow>
              {vm.totals ? (
                <>
                  <S.TotalTd>{vm.totals.label}</S.TotalTd>
                  {vm.totals.values.map((value, index) => (
                    <S.TotalTd key={vm.totalsColumns[index].key} $numeric>{value}</S.TotalTd>
                  ))}
                </>
              ) : (
                <S.TotalTd colSpan={Math.max(1, vm.columns.length)}>{vm.totalsInline}</S.TotalTd>
              )}
            </S.TotalRow>
          </tfoot>
        )}
      </S.Table>
      {vm.isEmpty && <S.Empty>{vm.emptyMessage}</S.Empty>}
    </S.Scroll>
  );
};
