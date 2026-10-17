import React from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { useT } from '../../../../shared/i18n/useT';
import { useAttachDownloadDialogViewModel } from './AttachDownloadDialog.viewmodel';
import type { AttachDownloadDialogProps } from './AttachDownloadDialog.viewmodel';
import { S } from './AttachDownloadDialog.styles';

/** "Anexar a um registro": escolher a tela e o registro, e o servidor move o arquivo para a aba Documentos. */
export const AttachDownloadDialog: React.FC<AttachDownloadDialogProps> = (props) => {
  const vm = useAttachDownloadDialogViewModel(props);
  const t = useT('core.documents');

  return (
    <Modal title={t('downloads.attach.title')} onClose={props.onClose}>
      <S.Body>
        {!vm.hasScreens ? (
          <InfoBanner variant="info" message={t('downloads.attach.no-screens')} />
        ) : (
          <>
            <InfoBanner variant="info" message={t('downloads.attach.hint', { name: props.download.name })} />
            <S.Field>
              <Label>{t('downloads.attach.screen')}</Label>
              <SearchSelect options={vm.screenOptions} value={vm.collection} onChange={vm.setCollection} />
            </S.Field>
            <S.Field>
              <Label>{t('downloads.attach.record')}</Label>
              <SearchSelect options={vm.recordOptions} value={vm.recordId} onChange={vm.setRecordId} />
            </S.Field>
            <S.Field>
              <Label>{t('field.document-type')}</Label>
              <SearchSelect options={vm.documentTypeOptions} value={vm.documentType} onChange={vm.setDocumentType} />
            </S.Field>
          </>
        )}
        <S.Footer>
          <Button variant="ghost" size="sm" onClick={props.onClose}>{t('core.ui/action.cancel')}</Button>
          <Button variant="primary" size="sm" disabled={!vm.canAttach} onClick={() => void vm.handleAttach()}>
            {t(vm.isAttaching ? 'downloads.attach.running' : 'downloads.attach.submit')}
          </Button>
        </S.Footer>
      </S.Body>
    </Modal>
  );
};
