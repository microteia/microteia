import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RiFileTextLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { Spinner } from '../../../../components/ui/Spinner';
import { useT } from '../../../../shared/i18n/useT';
import { useTemplatePreviewViewModel } from './TemplatePreview.viewmodel';
import type { TemplatePreviewProps } from './TemplatePreview.viewmodel';
import { S } from './TemplatePreview.styles';

/**
 * A pré-visualização do modelo, ao lado do editor. O Markdown sai SEM HTML (`skipHtml`): nenhum HTML do
 * texto é executado, e os comentários — `<!-- pagebreak -->`, as notas de quem edita — somem, como no
 * arquivo gerado.
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = (props) => {
  const vm = useTemplatePreviewViewModel(props);
  const t = useT('core.documents');

  return (
    <S.Body>
      <S.Toolbar>
        {vm.isPayload ? (
          <InfoBanner variant="info" message={t(vm.missingSample ? 'preview.sample-missing' : 'preview.sample')} />
        ) : (
          <S.Field>
            <SearchSelect
              options={vm.recordOptions}
              value={vm.recordId}
              onChange={vm.setRecordId}
              label={t('preview.record')}
            />
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

      {vm.emptyFields.length > 0 && (
        <S.Gaps>
          <summary>{t('preview.gaps', { count: String(vm.emptyFields.length) })}</summary>
          <ul>
            {vm.emptyFields.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </S.Gaps>
      )}

      {/* A folha só aparece quando há o que pôr nela: vazia, era uma caixa sem sentido sob o aviso. */}
      {vm.isLoading && <S.Center><Spinner /></S.Center>}
      {!vm.isLoading && vm.text !== null && (
        <S.Desk>
          <S.Paper>
            {vm.isWord ? (
              <S.PlainText>{vm.text}</S.PlainText>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{vm.text}</ReactMarkdown>
            )}
          </S.Paper>
        </S.Desk>
      )}
    </S.Body>
  );
};
