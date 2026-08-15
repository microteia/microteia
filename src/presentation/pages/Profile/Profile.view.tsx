import React, { useMemo } from 'react';
import {
  RiUserLine,
  RiCloseLine,
  RiCameraLine,
  RiLoader4Line,
  RiLockLine,
  RiCheckLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DateInput } from '../../components/ui/DateInput';
import { ImageCropModal } from '../../components/ui/ImageCropModal';
import { Spinner } from '../../components/ui/Spinner';
import { useProfileViewModel, PROFILE_PHOTO_INPUT_ID } from './Profile.viewmodel';
import { S } from './Profile.styles';

import { useT } from '../../shared/i18n/useT';
const GENDER_KEYS = [
  { value: 'M', labelKey: 'profile.gender.male' },
  { value: 'F', labelKey: 'profile.gender.female' },
  { value: 'N', labelKey: 'profile.gender.unspecified' },
];

interface NicknameSectionProps {
  vm: ReturnType<typeof useProfileViewModel>;
}

const NicknameSection: React.FC<NicknameSectionProps> = ({ vm }) => {
  const t = useT('core.workspace');
  if (vm.isNicknameLocked) {
    return (
      <S.Section>
        <S.SectionTitle>{t('profile.nickname')}</S.SectionTitle>
        <S.NicknameLockedRow>
          <RiLockLine size={14} />
          <S.NicknameLockedValue>{vm.existingNickname}</S.NicknameLockedValue>
        </S.NicknameLockedRow>
        <S.NicknameHint>{t('profile.nickname.locked')}</S.NicknameHint>
      </S.Section>
    );
  }

  return (
    <S.Section>
      <S.SectionTitle>{t('profile.nickname')}</S.SectionTitle>

      {vm.existingNickname && (
        <S.NicknameCurrentBadge>
          {t('profile.nickname.current', { nickname: vm.existingNickname })}
        </S.NicknameCurrentBadge>
      )}

      <S.FormGroup>
        <S.Label htmlFor="nickname">{t('profile.nickname.choose')}</S.Label>
        <S.Input
          id="nickname"
          value={vm.nicknameInput}
          onChange={(e) => vm.handleNicknameChange(e.target.value)}
          placeholder={t('profile.nickname.placeholder')}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
        />
      </S.FormGroup>

      <S.NicknameStatusRow>
        {vm.nicknameStatus === 'checking' && (
          <>
            <S.NicknameStatusIcon $spin>
              <RiLoader4Line size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="checking">{t('profile.nickname.checking')}</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'available' && (
          <>
            <S.NicknameStatusIcon>
              <RiCheckLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="available">{t('profile.nickname.available')}</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'taken' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="taken">{t('profile.nickname.taken')}</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'blocked' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="blocked">{t('profile.nickname.blocked')}</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'invalid' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="invalid">{t('profile.nickname.invalid')}</S.NicknameStatusText>
          </>
        )}
      </S.NicknameStatusRow>

      {vm.nicknameInput.length > 0 && vm.nicknameInput.length < 3 && (
        <S.NicknameHint>{t('profile.nickname.min-length')}</S.NicknameHint>
      )}

      {vm.nicknameError && (
        <S.Feedback $type="error">{vm.nicknameError}</S.Feedback>
      )}

      {vm.nicknameStatus === 'available' && (
        <S.NicknameActions>
          <Button
            size="sm"
            onClick={vm.handleSaveNickname}
            $isLoading={vm.nicknameSaving}
            disabled={vm.nicknameSaving}
          >
            {t(vm.nicknameSaving ? 'core.ui/action.saving' : 'profile.nickname.set')}
          </Button>
        </S.NicknameActions>
      )}

      <S.NicknameHint>{t('profile.nickname.rules')}</S.NicknameHint>
    </S.Section>
  );
};

export const ProfileView: React.FC = () => {
  const t = useT('core.workspace');
  const genderOptions = useMemo(
    () => GENDER_KEYS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );
  const vm = useProfileViewModel();
  const initial = vm.userDisplayName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <S.Page>
      <S.PageHeader>
        <S.PageTitle>
          <RiUserLine size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('page.profile')}
        </S.PageTitle>
      </S.PageHeader>

      <S.Content>
        <S.Section>
          <S.AvatarRow>
            <S.AvatarWrapper>
              <S.Avatar>
                {vm.effectivePhotoURL ? (
                  <S.AvatarImg src={vm.effectivePhotoURL} alt={t('profile.photo.alt')} referrerPolicy="no-referrer" />
                ) : (
                  <S.AvatarInitial>{initial}</S.AvatarInitial>
                )}
              </S.Avatar>
              <S.AvatarUploadBadge
                onClick={vm.triggerFileInput}
                title={t('profile.photo.change')}
              >
                {vm.isUploadingPhoto ? <RiLoader4Line size={14} /> : <RiCameraLine size={14} />}
              </S.AvatarUploadBadge>
              {vm.hasCustomPhoto && (
                <S.AvatarRemoveBadge onClick={vm.handleClearPhoto} title={t('profile.photo.remove')}>
                  <RiCloseLine size={12} />
                </S.AvatarRemoveBadge>
              )}
            </S.AvatarWrapper>

            <S.AvatarIdentity>
              <S.AvatarIdentityItem>
                <S.AvatarIdentityLabel>{t('core.ui/field.email')}</S.AvatarIdentityLabel>
                <S.AvatarIdentityValue>{vm.userEmail}</S.AvatarIdentityValue>
              </S.AvatarIdentityItem>
              <S.AvatarIdentityItem>
                <S.AvatarIdentityLabel>{t('profile.account')}</S.AvatarIdentityLabel>
                <S.AvatarIdentityValue>{vm.userDisplayName || '—'}</S.AvatarIdentityValue>
              </S.AvatarIdentityItem>
              {vm.photoError && <S.PhotoError>{vm.photoError}</S.PhotoError>}
            </S.AvatarIdentity>
          </S.AvatarRow>

          <input
            id={PROFILE_PHOTO_INPUT_ID}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={vm.handleFileInputChange}
          />
        </S.Section>

        <NicknameSection vm={vm} />

        {vm.profileLoading ? <Spinner /> : (
          <S.Section>
            <S.SectionTitle>{t('profile.personal-data')}</S.SectionTitle>

            <S.FormGrid>
              <S.FormGroup>
                <S.Label htmlFor="fullName">{t('profile.full-name')}</S.Label>
                <S.Input
                  id="fullName"
                  value={vm.form.fullName}
                  onChange={(e) => vm.handleFormChange('fullName', e.target.value)}
                  placeholder={vm.userDisplayName || t('profile.full-name.placeholder')}
                />
              </S.FormGroup>

              <S.FormGroup>
                <S.Label htmlFor="phone">{t('core.ui/field.phone')}</S.Label>
                <S.Input
                  id="phone"
                  value={vm.form.phone}
                  onChange={(e) => vm.handleFormChange('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
              </S.FormGroup>

              <S.FormGroup>
                <S.Label htmlFor="birthDate">{t('profile.birth-date')}</S.Label>
                <DateInput
                  id="birthDate"
                  value={vm.form.birthDate}
                  onChange={(val) => vm.handleFormChange('birthDate', val)}
                />
              </S.FormGroup>

              <S.FormGroupFull>
                <S.Label>{t('profile.gender')}</S.Label>
                <SearchSelect
                  options={genderOptions}
                  value={vm.form.gender}
                  onChange={(v) => vm.handleFormChange('gender', v)}
                  placeholder={t('core.ui/action.select')}
                />
              </S.FormGroupFull>
            </S.FormGrid>

            <S.FormActions>
              {vm.profileError && (
                <S.Feedback $type="error">{vm.profileError}</S.Feedback>
              )}
              <Button
                onClick={vm.handleSaveProfile}
                $isLoading={vm.profileSaving}
                disabled={vm.profileSaving}
              >
                {t(vm.profileSaving ? 'core.ui/action.saving' : 'profile.save')}
              </Button>
            </S.FormActions>
          </S.Section>
        )}
      </S.Content>

      {vm.cropSrc && (
        <ImageCropModal
          imageSrc={vm.cropSrc}
          onCrop={vm.handleCropConfirm}
          onClose={vm.handleCropCancel}
        />
      )}
    </S.Page>
  );
};
