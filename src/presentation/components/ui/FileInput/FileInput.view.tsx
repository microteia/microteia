import React from 'react';
import { RiDeleteBinLine, RiFileTextLine, RiUploadLine } from 'react-icons/ri';
import { S } from './FileInput.styles';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { useFileInputViewModel, type FileInputProps } from './FileInput.viewmodel';
import { useT } from '../../../shared/i18n/useT';

/**
 * O controle de um campo `file`. Sem `upload` ele fica somente-leitura em vez de falhar em silêncio:
 * é o que acontece num formulário que não é de registro (a configuração do escritório) ou numa
 * extensão que montou o campo sem ligar o envio.
 */
export const FileInput: React.FC<FileInputProps> = (props) => {
  const vm = useFileInputViewModel(props);
  const t = useT('core.ui');

  return (
    <S.Wrapper>
      <S.HiddenInput
        id={vm.inputId}
        type="file"
        accept={vm.acceptAttribute}
        onChange={vm.handlePick}
        disabled={!vm.canUpload}
      />

      <S.Row>
        {vm.hasValue && vm.showImagePreview && (
          <S.Preview src={props.value} alt={vm.fileName} />
        )}

        {vm.hasValue && !vm.showImagePreview && (
          <S.Chip href={props.value} target="_blank" rel="noreferrer" title={t('file.open')}>
            <RiFileTextLine size={14} />
            <S.ChipName>{vm.fileName}</S.ChipName>
          </S.Chip>
        )}

        {!vm.hasValue && <S.Empty>{t('file.empty')}</S.Empty>}

        {vm.isUploading && (
          <>
            <Spinner size={16} />
            <S.Hint>{t('file.uploading')}</S.Hint>
          </>
        )}

        {vm.canUpload && !vm.isUploading && (
          <Button as="label" htmlFor={vm.inputId} variant="secondary" size="sm">
            <RiUploadLine size={14} />
            {vm.hasValue ? t('file.replace') : t('file.choose')}
          </Button>
        )}

        {vm.canUpload && !vm.isUploading && vm.hasValue && (
          <Button type="button" variant="secondary" size="sm" onClick={vm.handleRemove} title={t('action.remove')}>
            <RiDeleteBinLine size={14} />
          </Button>
        )}
      </S.Row>

      {vm.uploadUnavailable && <S.Hint>{t('file.upload-blocked')}</S.Hint>}
      {vm.canUpload && vm.acceptedHint && <S.Hint>{vm.acceptedHint}</S.Hint>}
    </S.Wrapper>
  );
};
