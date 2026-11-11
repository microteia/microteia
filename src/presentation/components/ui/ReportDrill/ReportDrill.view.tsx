import React from 'react';
import { S } from './ReportDrill.styles';
import { useReportDrillViewModel } from './ReportDrill.viewmodel';
import { Modal } from '../Modal';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export interface ReportDrillProps {
  spec: ReportSpec;
  title: string;
  records: Record<string, unknown>[];
  matched: number;
  isLoading: boolean;
  onOpenRecord: (recordId: string) => void;
  onClose: () => void;
}

/** O detalhamento de um número: os registros que o compõem, cada um abrindo o próprio registro. */
export const ReportDrill: React.FC<ReportDrillProps> = ({
  spec, title, records, matched, isLoading, onOpenRecord, onClose,
}) => {
  const vm = useReportDrillViewModel(spec, records, matched);

  return (
    <Modal title={title} onClose={onClose} size="xlarge">
      {vm.truncated && <S.Notice>{vm.truncated}</S.Notice>}
      {isLoading ? (
        <S.Empty>{vm.loadingMessage}</S.Empty>
      ) : vm.rows.length === 0 ? (
        <S.Empty>{vm.emptyMessage}</S.Empty>
      ) : (
        <S.Scroll>
          <S.Table>
            <thead>
              <tr>
                {vm.columns.map((column) => <S.Th key={column.key}>{column.label}</S.Th>)}
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((row) => (
                <S.Row key={row.id} onClick={() => onOpenRecord(row.id)}>
                  {row.cells.map((cell, index) => (
                    <S.Td key={vm.columns[index]?.key ?? index}>{cell}</S.Td>
                  ))}
                </S.Row>
              ))}
            </tbody>
          </S.Table>
        </S.Scroll>
      )}
    </Modal>
  );
};
