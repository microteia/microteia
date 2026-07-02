import React from 'react';
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

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'N', label: 'Não Informado' },
];

interface NicknameSectionProps {
  vm: ReturnType<typeof useProfileViewModel>;
}

const NicknameSection: React.FC<NicknameSectionProps> = ({ vm }) => {
  if (vm.isNicknameLocked) {
    return (
      <S.Section>
        <S.SectionTitle>Apelido</S.SectionTitle>
        <S.NicknameLockedRow>
          <RiLockLine size={14} />
          <S.NicknameLockedValue>{vm.existingNickname}</S.NicknameLockedValue>
        </S.NicknameLockedRow>
        <S.NicknameHint>O apelido é permanente e não pode ser alterado.</S.NicknameHint>
      </S.Section>
    );
  }

  return (
    <S.Section>
      <S.SectionTitle>Apelido</S.SectionTitle>

      {vm.existingNickname && (
        <S.NicknameCurrentBadge>
          Atual: {vm.existingNickname}
        </S.NicknameCurrentBadge>
      )}

      <S.FormGroup>
        <S.Label htmlFor="nickname">Escolha seu apelido permanente</S.Label>
        <S.Input
          id="nickname"
          value={vm.nicknameInput}
          onChange={(e) => vm.handleNicknameChange(e.target.value)}
          placeholder="ex: joao.silva, maria_123"
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
            <S.NicknameStatusText $status="checking">Verificando disponibilidade...</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'available' && (
          <>
            <S.NicknameStatusIcon>
              <RiCheckLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="available">Disponível</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'taken' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="taken">Já está em uso</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'blocked' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="blocked">Apelido não permitido</S.NicknameStatusText>
          </>
        )}
        {vm.nicknameStatus === 'invalid' && (
          <>
            <S.NicknameStatusIcon>
              <RiCloseLine size={13} />
            </S.NicknameStatusIcon>
            <S.NicknameStatusText $status="invalid">Apenas letras, números, . _ -</S.NicknameStatusText>
          </>
        )}
      </S.NicknameStatusRow>

      {vm.nicknameInput.length > 0 && vm.nicknameInput.length < 3 && (
        <S.NicknameHint>Mínimo 3 caracteres.</S.NicknameHint>
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
            {vm.nicknameSaving ? 'Salvando...' : 'Definir Apelido'}
          </Button>
        </S.NicknameActions>
      )}

      <S.NicknameHint>
        Após definido, o apelido não pode ser alterado. Use apenas letras (a-z), números (0-9), ponto (.), underscore (_) ou hífen (-).
      </S.NicknameHint>
    </S.Section>
  );
};

export const ProfileView: React.FC = () => {
  const vm = useProfileViewModel();
  const initial = vm.userDisplayName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <S.Page>
      <S.PageHeader>
        <S.PageTitle>
          <RiUserLine size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Meu Perfil
        </S.PageTitle>
      </S.PageHeader>

      <S.Content>
        <S.Section>
          <S.AvatarRow>
            <S.AvatarWrapper>
              <S.Avatar>
                {vm.effectivePhotoURL ? (
                  <S.AvatarImg src={vm.effectivePhotoURL} alt="Foto de perfil" referrerPolicy="no-referrer" />
                ) : (
                  <S.AvatarInitial>{initial}</S.AvatarInitial>
                )}
              </S.Avatar>
              <S.AvatarUploadBadge
                onClick={vm.triggerFileInput}
                title="Alterar foto"
              >
                {vm.isUploadingPhoto ? <RiLoader4Line size={14} /> : <RiCameraLine size={14} />}
              </S.AvatarUploadBadge>
              {vm.hasCustomPhoto && (
                <S.AvatarRemoveBadge onClick={vm.handleClearPhoto} title="Remover foto personalizada">
                  <RiCloseLine size={12} />
                </S.AvatarRemoveBadge>
              )}
            </S.AvatarWrapper>

            <S.AvatarIdentity>
              <S.AvatarIdentityItem>
                <S.AvatarIdentityLabel>E-mail</S.AvatarIdentityLabel>
                <S.AvatarIdentityValue>{vm.userEmail}</S.AvatarIdentityValue>
              </S.AvatarIdentityItem>
              <S.AvatarIdentityItem>
                <S.AvatarIdentityLabel>Conta</S.AvatarIdentityLabel>
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
            <S.SectionTitle>Dados Pessoais</S.SectionTitle>

            <S.FormGrid>
              <S.FormGroup>
                <S.Label htmlFor="fullName">Nome Completo</S.Label>
                <S.Input
                  id="fullName"
                  value={vm.form.fullName}
                  onChange={(e) => vm.handleFormChange('fullName', e.target.value)}
                  placeholder={vm.userDisplayName || 'Seu nome completo'}
                />
              </S.FormGroup>

              <S.FormGroup>
                <S.Label htmlFor="phone">Telefone</S.Label>
                <S.Input
                  id="phone"
                  value={vm.form.phone}
                  onChange={(e) => vm.handleFormChange('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
              </S.FormGroup>

              <S.FormGroup>
                <S.Label htmlFor="birthDate">Data de Nascimento</S.Label>
                <DateInput
                  id="birthDate"
                  value={vm.form.birthDate}
                  onChange={(val) => vm.handleFormChange('birthDate', val)}
                />
              </S.FormGroup>

              <S.FormGroupFull>
                <S.Label>Sexo</S.Label>
                <SearchSelect
                  options={GENDER_OPTIONS}
                  value={vm.form.gender}
                  onChange={(v) => vm.handleFormChange('gender', v)}
                  placeholder="Selecione..."
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
                {vm.profileSaving ? 'Salvando...' : 'Salvar Perfil'}
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
