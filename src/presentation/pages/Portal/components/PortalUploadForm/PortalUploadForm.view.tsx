import React from 'react';
import { RiAttachmentLine } from 'react-icons/ri';
import { usePortalUploadFormViewModel, type PortalUploadFormProps } from './PortalUploadForm.viewmodel';
import { S } from './PortalUploadForm.styles';
import { Button } from '../../../../components/ui/Button';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { useT } from '../../../../shared/i18n/useT';

export const PortalUploadForm: React.FC<PortalUploadFormProps> = (props) => {
  // A ref sai do resto na desestruturação: só ela vai para o DOM, e nada lê `.current` no render.
  const { fileInputRef, ...vm } = usePortalUploadFormViewModel(props);
  const t = useT('core.tenant');

  return (
    <S.Box>
      <S.Title>{t('portal.upload')}</S.Title>
      <S.Row>
        <SearchSelect
          options={props.types}
          value={vm.type}
          onChange={vm.setType}
          placeholder={t('portal.upload.type.placeholder')}
        />
        <input ref={fileInputRef} type="file" hidden onChange={vm.chooseFile} />
        <Button variant="secondary" size="sm" onClick={vm.pickFile} disabled={vm.sending}>
          <RiAttachmentLine size={14} />
          {vm.fileName || t('portal.upload.choose')}
        </Button>
        <Button size="sm" onClick={() => void vm.send()} disabled={!vm.canSend}>
          {vm.sending ? t('portal.upload.sending') : t('portal.upload.send')}
        </Button>
      </S.Row>
      {vm.error && <S.Error>{vm.error}</S.Error>}
      {vm.sent && <S.Success>{t('portal.upload.sent')}</S.Success>}
    </S.Box>
  );
};
