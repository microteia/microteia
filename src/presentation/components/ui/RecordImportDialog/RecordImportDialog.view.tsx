import React from 'react';
import { RiDownloadLine, RiUploadLine } from 'react-icons/ri';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Label } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { InfoBanner } from '../InfoBanner';
import { ConfirmModal } from '../ConfirmModal';
import { useRecordImportDialogViewModel } from './RecordImportDialog.viewmodel';
import type { RecordImportDialogProps } from './RecordImportDialog.viewmodel';
import { S } from './RecordImportDialog.styles';
import { useT } from '../../../shared/i18n/useT';

/**
 * Importar registros de um arquivo: escolher o arquivo, ligar cada coluna a um campo, simular, importar
 * e ler o relatório. Cada linha é gravada no servidor pelo mesmo caminho do formulário.
 */
export const RecordImportDialog: React.FC<RecordImportDialogProps> = (props) => {
  const vm = useRecordImportDialogViewModel(props);
  const t = useT('core.records');

  return (
    <Modal title={vm.title} onClose={vm.close} size="large">
      <S.Body>
        {vm.step === 'file' && (
          <>
            <S.Hint>{vm.hint}</S.Hint>
            <S.HiddenInput id={vm.inputId} type="file" accept=".csv,.txt,.json" onChange={vm.handlePick} />
            <S.Row>
              <Button as="label" htmlFor={vm.inputId} variant="secondary" size="sm">
                <RiUploadLine size={14} />
                {t('import.file.choose')}
              </Button>
              {vm.fileName && <S.Muted>{vm.fileName}</S.Muted>}
            </S.Row>
            {vm.fileError && <InfoBanner variant="warning" message={vm.fileError} />}
          </>
        )}

        {vm.step === 'mapping' && (
          <>
            <S.Muted>{vm.fileName}</S.Muted>
            <InfoBanner variant={vm.keyNotice.variant} message={vm.keyNotice.message} />
            {vm.requiredNotice && <InfoBanner variant="info" message={vm.requiredNotice} />}
            {vm.runError && <InfoBanner variant="warning" message={vm.runError} />}
            <S.Table>
              <S.HeaderRow>
                <S.HeaderCell>{t('import.mapping.column-header')}</S.HeaderCell>
                <S.HeaderCell>{t('import.mapping.sample')}</S.HeaderCell>
                <S.HeaderCell>{t('import.mapping.field')}</S.HeaderCell>
              </S.HeaderRow>
              {vm.columns.map((column) => (
                <S.MappingRow key={column.index}>
                  <S.Cell>{column.header}</S.Cell>
                  <S.SampleCell title={column.sample}>{column.sample}</S.SampleCell>
                  <S.Cell>
                    <SearchSelect
                      options={vm.fieldOptions}
                      value={column.fieldKey}
                      onChange={(value) => vm.setColumnField(column.index, value)}
                    />
                  </S.Cell>
                </S.MappingRow>
              ))}
            </S.Table>
            {vm.showsTextOptions && (
              <S.Options>
                <S.Field>
                  <Label>{t('import.option.decimal')}</Label>
                  <SearchSelect options={vm.decimalOptions} value={vm.decimalSeparator} onChange={vm.setDecimalSeparator} />
                </S.Field>
                <S.Field>
                  <Label>{t('import.option.date')}</Label>
                  <SearchSelect options={vm.dateOptions} value={vm.dateFormat} onChange={vm.setDateFormat} />
                </S.Field>
              </S.Options>
            )}
            {vm.mappingError && <InfoBanner variant="warning" message={vm.mappingError} />}
            <S.Footer>
              <Button variant="ghost" size="sm" onClick={vm.backToFile}>{t('import.action.other-file')}</Button>
              <Button variant="secondary" size="sm" disabled={!vm.canRun} onClick={vm.simulate}>{t('import.action.simulate')}</Button>
              <Button variant="primary" size="sm" disabled={!vm.canRun} onClick={vm.askImport}>{t('import.action.import')}</Button>
            </S.Footer>
          </>
        )}

        {vm.step === 'running' && (
          <>
            <S.Muted>{vm.progressText}</S.Muted>
            <S.ProgressTrack>
              <S.ProgressBar $percent={vm.progressPercent} />
            </S.ProgressTrack>
            <S.Footer>
              <Button variant="secondary" size="sm" disabled={vm.isCancelling} onClick={vm.cancelRun}>
                {t(vm.isCancelling ? 'import.action.cancelling' : 'import.action.cancel')}
              </Button>
            </S.Footer>
          </>
        )}

        {vm.step === 'report' && (
          <>
            <InfoBanner variant={vm.canDownloadFailures ? 'warning' : 'info'} message={vm.summary} />
            {vm.reportRows.length > 0 && (
              <S.Table>
                <S.HeaderRow $report>
                  <S.HeaderCell>{t('import.report.line')}</S.HeaderCell>
                  <S.HeaderCell>{t('import.report.message')}</S.HeaderCell>
                </S.HeaderRow>
                {vm.reportRows.map((row) => (
                  <S.ReportRow key={row.key}>
                    <S.Cell>{row.line}</S.Cell>
                    <S.Cell>{row.message}</S.Cell>
                  </S.ReportRow>
                ))}
              </S.Table>
            )}
            {vm.hiddenFailures && <S.Muted>{vm.hiddenFailures}</S.Muted>}
            <S.Footer>
              {vm.canDownloadFailures && (
                <Button variant="ghost" size="sm" onClick={vm.downloadFailures}>
                  <RiDownloadLine size={14} />
                  {t('import.action.download-failures')}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={vm.backToMapping}>{t('import.action.back')}</Button>
              {vm.canImportAfterSimulation && (
                <Button variant="primary" size="sm" onClick={vm.askImport}>{t('import.action.import')}</Button>
              )}
              {!vm.canImportAfterSimulation && (
                <Button variant="primary" size="sm" onClick={vm.close}>{t('import.action.done')}</Button>
              )}
            </S.Footer>
          </>
        )}
      </S.Body>

      <ConfirmModal
        isOpen={vm.confirmOpen}
        title={t('import.confirm.title')}
        message={vm.confirmMessage}
        confirmLabel={t('import.action.import')}
        onConfirm={vm.runImport}
        onCancel={vm.cancelConfirm}
      />
    </Modal>
  );
};
