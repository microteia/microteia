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

/** "Gerar documento": escolher o modelo e o formato, e o servidor gera e anexa à aba Documentos. */
export const GenerateDocumentDialog: React.FC<RecordDialogProps> = (props) => {
  const vm = useGenerateDocumentDialogViewModel(props);
  const t = useT('core.documents');

  return (
    <Modal title={t('generate.title')} onClose={vm.onClose}>
      <S.Body>
        {!vm.hasDocuments ? (
          <InfoBanner variant="info" message={t('generate.no-documents-tab')} />
        ) : vm.templateOptions.length === 0 ? (
          <InfoBanner variant="info" message={t('generate.no-templates')} />
        ) : (
          <>
            <S.Field>
              <Label>{t('generate.template')}</Label>
              <SearchSelect options={vm.templateOptions} value={vm.templateKey} onChange={vm.setTemplateKey} />
            </S.Field>
            <S.Field>
              <Label>{t('generate.output')}</Label>
              <SearchSelect options={vm.outputOptions} value={vm.output} onChange={vm.setOutput} />
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
