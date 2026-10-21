import React from 'react';
import { useOfficeTabViewModel } from './OfficeTab.viewmodel';
import { S } from './OfficeTab.styles';
import { Button } from '../../../components/ui/Button';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { CustomFieldsSection } from '../../../components/ui/CustomFieldsSection';
import { ImageCropModal } from '../../../components/ui/ImageCropModal';
import { RiImageAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { TENANT_LOGO_INPUT_ID } from './OfficeTab.viewmodel';
import { useT } from '../../../shared/i18n/useT';

export const OfficeTabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = useOfficeTabViewModel();

  return (
    <S.Container>
      {!vm.isAdmin && <InfoBanner message={t('office.admin-only')} variant="info" />}

      <S.LogoRow>
        <S.LogoBox>
          {vm.logoURL ? <S.LogoImg src={vm.logoURL} alt={t('office.logo.alt')} /> : <RiImageAddLine size={22} />}
        </S.LogoBox>
        <S.LogoText>
          <S.LogoTitle>{t('office.logo.title')}</S.LogoTitle>
          <S.LogoHint>{t('office.logo.hint')}</S.LogoHint>
          {vm.logoError && <S.LogoError>{vm.logoError}</S.LogoError>}
        </S.LogoText>
        {vm.isAdmin && (
          <S.LogoActions>
            <Button variant="secondary" size="sm" onClick={vm.chooseLogo} disabled={vm.logoBusy}>
              {vm.logoURL ? t('office.logo.change') : t('office.logo.upload')}
            </Button>
            {vm.logoURL && (
              <Button variant="ghost" size="sm" onClick={() => void vm.removeLogo()} disabled={vm.logoBusy} title={t('office.logo.remove')}>
                <RiDeleteBinLine size={14} />
              </Button>
            )}
          </S.LogoActions>
        )}
        <S.HiddenInput id={TENANT_LOGO_INPUT_ID} type="file" accept="image/*" onChange={vm.handleLogoFile} />
      </S.LogoRow>

      <CustomFieldsSection
        fields={vm.fields}
        values={vm.values}
        errors={vm.fieldErrors}
        disabled={!vm.isAdmin}
        onChange={vm.setFieldValue}
      />

      {vm.isAdmin && (
        <S.SaveRow>
          <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
            {vm.isSaving ? t('core.ui/action.saving') : t('core.ui/action.save')}
          </Button>
        </S.SaveRow>
      )}
      {vm.cropSrc && (
        <ImageCropModal imageSrc={vm.cropSrc} onCrop={vm.confirmLogoCrop} onClose={vm.cancelLogoCrop} />
      )}
    </S.Container>
  );
};
