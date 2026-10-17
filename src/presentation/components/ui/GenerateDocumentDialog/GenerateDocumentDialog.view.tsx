import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Label } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { InfoBanner } from '../InfoBanner';
import type { RecordDialogProps } from '../../../../stores/useRecordDialog';
import { useGenerateDocumentDialogViewModel } from './GenerateDocumentDialog.viewmodel';
import { S } from './GenerateDocumentDialog.styles';
import { useT } from '../../../shared/i18n/useT';

/** "Gerar documento": escolher o modelo, o formato e o destino, e o servidor gera e entrega. */
export const GenerateDocumentDialog: React.FC<RecordDialogProps> = (props) => {
  const vm = useGenerateDocumentDialogViewModel(props);
  const t = useT('core.documents');

  return (
    <Modal title={t('generate.title')} onClose={vm.onClose}>
      <S.Body>
        {vm.templateOptions.length === 0 ? (
          <InfoBanner variant="info" message={t('generate.no-templates')} />
        ) : (
          <>
            {vm.downloadsOnly && <InfoBanner variant="info" message={t('generate.downloads-only')} />}
            <S.Field>
              <Label>{t('generate.template')}</Label>
              <SearchSelect options={vm.templateOptions} value={vm.templateKey} onChange={vm.setTemplateKey} />
            </S.Field>
            <S.Field>
              <Label>{t('generate.output')}</Label>
              <SearchSelect options={vm.outputOptions} value={vm.output} onChange={vm.setOutput} />
            </S.Field>
            <S.Field>
              <Label>{t('generate.destination')}</Label>
              <SearchSelect options={vm.destinationOptions} value={vm.destination} onChange={vm.setDestination} />
            </S.Field>
          </>
        )}
        <S.Footer>
          <Button variant="ghost" size="sm" onClick={vm.onClose}>{t('core.ui/action.cancel')}</Button>
          <Button variant="primary" size="sm" disabled={!vm.canGenerate} onClick={() => void vm.handleGenerate()}>
            {t(vm.isGenerating ? 'generate.running' : 'generate.submit')}
          </Button>
        </S.Footer>
      </S.Body>
    </Modal>
  );
};
