import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { useNotification } from '../../../stores/useNotification';
import { makeGetUserProfileUseCase } from '../../../domain/usecases/profile/GetUserProfileUseCase';
import { makeSaveUserProfileUseCase } from '../../../domain/usecases/profile/SaveUserProfileUseCase';
import { makeUploadProfilePhotoUseCase } from '../../../domain/usecases/profile/UploadProfilePhotoUseCase';
import { makeCheckNicknameAvailabilityUseCase } from '../../../domain/usecases/profile/CheckNicknameAvailabilityUseCase';
import { makeClaimNicknameUseCase } from '../../../domain/usecases/profile/ClaimNicknameUseCase';
import type { Gender, UserProfile } from '../../../domain/entities';

import { useT } from '../../shared/i18n/useT';
export type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'blocked';

export interface ProfileForm {
  fullName: string;
  phone: string;
  gender: string;
  birthDate: string;
}

export interface ProfileViewModel {
  effectivePhotoURL: string | null;
  hasCustomPhoto: boolean;
  userDisplayName: string;
  userEmail: string;

  profileLoading: boolean;
  profileSaving: boolean;
  profileError: string | null;
  form: ProfileForm;
  handleFormChange: (field: keyof ProfileForm, value: string) => void;
  handleSaveProfile: () => Promise<void>;

  nicknameInput: string;
  nicknameStatus: NicknameStatus;
  isNicknameLocked: boolean;
  existingNickname: string | null;
  nicknameSaving: boolean;
  nicknameError: string | null;
  handleNicknameChange: (value: string) => void;
  handleSaveNickname: () => Promise<void>;

  cropSrc: string | null;
  isUploadingPhoto: boolean;
  photoError: string | null;
  triggerFileInput: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCropConfirm: (blob: Blob) => Promise<void>;
  handleCropCancel: () => void;
  handleClearPhoto: () => Promise<void>;
}

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits.length) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const PROFILE_PHOTO_INPUT_ID = 'profile-photo-file-input';

/** A referência que o backend devolve quando o apelido foi tomado entre a checagem e a gravação. */
const NICKNAME_TAKEN_REF = '@core.workspace/profile.nickname.taken-error';

export const useProfileViewModel = (): ProfileViewModel => {
  const t = useT('core.workspace');
  const { user, reloadUserProfile } = useAuth();
  const { userProfileRepository } = useDI();
  const { notify } = useNotification();

  const getProfileUC = useMemo(() => makeGetUserProfileUseCase(userProfileRepository), [userProfileRepository]);
  const saveProfileUC = useMemo(() => makeSaveUserProfileUseCase(userProfileRepository), [userProfileRepository]);
  const uploadPhotoUC = useMemo(() => makeUploadProfilePhotoUseCase(userProfileRepository), [userProfileRepository]);
  const checkNicknameUC = useMemo(() => makeCheckNicknameAvailabilityUseCase(userProfileRepository), [userProfileRepository]);
  const claimNicknameUC = useMemo(() => makeClaimNicknameUseCase(userProfileRepository), [userProfileRepository]);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({ fullName: '', phone: '', gender: '', birthDate: '' });

  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null | undefined>(undefined);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const triggerFileInput = useCallback(() => {
    (document.getElementById(PROFILE_PHOTO_INPUT_ID) as HTMLInputElement | null)?.click();
  }, []);

  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const [isNicknameLocked, setIsNicknameLocked] = useState(false);
  const [existingNickname, setExistingNickname] = useState<string | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation is architecturally required
    setProfileLoading(true);
    getProfileUC.execute(user.id)
      .then((p: UserProfile | null) => {
        if (p) {
          setProfilePhotoURL(p.photoURL);
          setIsNicknameLocked(!!p.nicknameSetAt);
          setExistingNickname(p.nickname ?? null);
          setForm({
            fullName: p.fullName ?? '',
            phone: p.phone ?? '',
            gender: p.gender ?? '',
            birthDate: p.birthDate ? format(p.birthDate, 'yyyy-MM-dd') : '',
          });
        }
      })
      .catch(() => setProfileError(t('profile.load-failed')))
      .finally(() => setProfileLoading(false));
  }, [user, getProfileUC, t]);

  useEffect(() => {
    if (nicknameStatus !== 'checking' || nicknameInput.length < 3) return;
    const timer = setTimeout(() => {
      checkNicknameUC.execute(nicknameInput)
        .then((result) => {
          setNicknameStatus(
            result.available ? 'available' :
            result.reason === 'blocked' ? 'blocked' :
            result.reason === 'format'  ? 'invalid' :
            'taken',
          );
        })
        .catch(() => setNicknameStatus('idle'));
    }, 500);
    return () => clearTimeout(timer);
  }, [nicknameInput, nicknameStatus, checkNicknameUC]);

  const effectivePhotoURL = useMemo(
    () => profilePhotoURL ?? user?.photoURL ?? null,
    [profilePhotoURL, user?.photoURL],
  );

  const hasCustomPhoto = useMemo(() => typeof profilePhotoURL === 'string', [profilePhotoURL]);

  const handleFormChange = useCallback((field: keyof ProfileForm, value: string) => {
    if (field === 'phone') {
      setForm((prev) => ({ ...prev, phone: formatPhone(value) }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const data: Omit<UserProfile, 'id' | 'userId' | 'nickname' | 'nicknameSetAt'> = {
        fullName: form.fullName || null,
        phone: form.phone || null,
        gender: (form.gender as Gender) || null,
        birthDate: form.birthDate ? parseISO(form.birthDate) : null,
        photoURL: profilePhotoURL,
      };
      await saveProfileUC.execute(user.id, data);
      await reloadUserProfile();
      notify(t('profile.saved'), 'success');
    } catch {
      setProfileError(t('profile.save-failed'));
    } finally {
      setProfileSaving(false);
    }
  }, [user, form, profilePhotoURL, saveProfileUC, reloadUserProfile, notify, t]);

  const handleNicknameChange = useCallback((value: string) => {
    setNicknameInput(value);
    setNicknameError(null);

    if (!value) { setNicknameStatus('idle'); return; }
    if (!/^[a-zA-Z0-9._-]*$/.test(value)) { setNicknameStatus('invalid'); return; }
    if (value.length < 3) { setNicknameStatus('idle'); return; }
    setNicknameStatus('checking');
  }, []);

  const handleSaveNickname = useCallback(async () => {
    if (!user || nicknameStatus !== 'available' || !nicknameInput) return;
    setNicknameSaving(true);
    setNicknameError(null);
    try {
      await claimNicknameUC.execute(nicknameInput);
      setIsNicknameLocked(true);
      setExistingNickname(nicknameInput);
      setNicknameInput('');
      setNicknameStatus('idle');
      await reloadUserProfile();
      notify(t('profile.nickname.saved'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes(NICKNAME_TAKEN_REF)) {
        setNicknameStatus('taken');
        setNicknameError(t('profile.nickname.race'));
      } else {
        setNicknameError(t('profile.nickname.save-failed'));
      }
    } finally {
      setNicknameSaving(false);
    }
  }, [user, nicknameStatus, nicknameInput, claimNicknameUC, reloadUserProfile, notify, t]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(t('profile.photo.too-large'));
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPhotoError(t('profile.photo.invalid'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCropSrc(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [t]);

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setIsUploadingPhoto(true);
    setPhotoError(null);
    try {
      const url = await uploadPhotoUC.execute(user.id, blob, `photo_${Date.now()}.jpg`);
      await saveProfileUC.execute(user.id, { photoURL: url });
      setProfilePhotoURL(url);
      await reloadUserProfile();
    } catch {
      setPhotoError(t('profile.photo.upload-failed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [user, uploadPhotoUC, saveProfileUC, reloadUserProfile, t]);

  const handleCropCancel = useCallback(() => setCropSrc(null), []);

  const handleClearPhoto = useCallback(async () => {
    if (!user) return;
    try {
      await saveProfileUC.execute(user.id, { photoURL: null });
      setProfilePhotoURL(null);
      await reloadUserProfile();
    } catch {
      setPhotoError(t('profile.photo.remove-failed'));
    }
  }, [user, saveProfileUC, reloadUserProfile, t]);

  return {
    effectivePhotoURL,
    hasCustomPhoto,
    userDisplayName: user?.displayName ?? '',
    userEmail: user?.email ?? '',

    profileLoading,
    profileSaving,
    profileError,
    form,
    handleFormChange,
    handleSaveProfile,

    nicknameInput,
    nicknameStatus,
    isNicknameLocked,
    existingNickname,
    nicknameSaving,
    nicknameError,
    handleNicknameChange,
    handleSaveNickname,

    cropSrc,
    isUploadingPhoto,
    photoError,
    triggerFileInput,
    handleFileInputChange,
    handleCropConfirm,
    handleCropCancel,
    handleClearPhoto,
  };
};
