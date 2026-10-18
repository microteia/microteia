import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RiFileTextLine } from 'react-icons/ri';
import { Modal } from '../../../../components/ui/Modal';
import { Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { Spinner } from '../../../../components/ui/Spinner';
import { useT } from '../../../../shared/i18n/useT';
import { useTemplatePreviewDialogViewModel } from './TemplatePreviewDialog.viewmodel';
import type { TemplatePreviewDialogProps } from './TemplatePreviewDialog.viewmodel';
import { S } from './TemplatePreviewDialog.styles';

/**
 * A pré-visualização do modelo. O Markdown sai SEM HTML (`skipHtml`): nenhum HTML do texto é executado,
 * e os comentários — `<!-- pagebreak -->`, as notas de quem edita — somem, como no arquivo gerado.
 */
export const TemplatePreviewDialog: React.FC<TemplatePreviewDialogProps> = (props) => {
  const vm = useTemplatePreviewDialogViewModel(props);
  const t = useT('core.documents');

  return (
    <Modal title={t('preview.title')} onClose={props.onClose} size="xlarge">
      <S.Body>
        <S.Toolbar>
          {vm.isPayload ? (
            <InfoBanner variant="info" message={t(vm.missingSample ? 'preview.sample-missing' : 'preview.sample')} />
          ) : (
            <S.Field>
              <Label>{t('preview.record')}</Label>
              <SearchSelect options={vm.recordOptions} value={vm.recordId} onChange={vm.setRecordId} />
            </S.Field>
          )}
          {vm.fileName && (
            <S.FileName><RiFileTextLine size={12} /> {vm.fileName}</S.FileName>
          )}
        </S.Toolbar>

        {!vm.isPayload && vm.recordOptions.length === 0 && (
          <InfoBanner variant="info" message={t('preview.no-records')} />
        )}
        {vm.error && <InfoBanner message={vm.error} />}
        {vm.isWord && vm.text !== null && <InfoBanner variant="info" message={t('preview.word')} />}

        <S.Desk>
          {vm.isLoading ? (
            <S.Center><Spinner /></S.Center>
          ) : (
            vm.text !== null && (
              <S.Paper>
                {vm.isWord ? (
                  <S.PlainText>{vm.text}</S.PlainText>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{vm.text}</ReactMarkdown>
                )}
              </S.Paper>
            )
          )}
        </S.Desk>

        {vm.emptyFields.length > 0 && (
          <S.Gaps>
            <summary>{t('preview.gaps', { count: String(vm.emptyFields.length) })}</summary>
            <ul>
              {vm.emptyFields.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </S.Gaps>
        )}
      </S.Body>
    </Modal>
  );
};
