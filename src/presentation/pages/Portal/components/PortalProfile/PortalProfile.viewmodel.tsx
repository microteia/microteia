import { useCallback, useState } from 'react';
import { useAuth } from '../../../../../stores/useAuth';
import { usePortal } from '../../../../../stores/usePortal';
import { PORTAL_PROFILE_VALUE_MAX } from '../../../../../domain/schema/portal';

export interface PortalProfileViewModel {
  name: string;
  setName: (name: string) => void;
  nameMaxLength: number;
  office: string;
  /** Só leitura: é com ele que a pessoa entra, e a troca é da autenticação, não do perfil. */
  email: string;
  saving: boolean;
  saved: boolean;
  failed: boolean;
  save: () => Promise<void>;
}

/** O perfil que o convidado mantém NESTE escritório — hoje, o nome com que o portal o chama. */
export const usePortalProfileViewModel = (): PortalProfileViewModel => {
  const { user } = useAuth();
  const { profile, saveProfile, context } = usePortal();
  const [name, setNameState] = useState(profile.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const setName = useCallback((next: string) => {
    setNameState(next);
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setFailed(false);
    try {
      await saveProfile({ ...profile, name });
      setSaved(true);
    } catch (err) {
      console.error('[PortalProfile] save error:', err);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [saveProfile, profile, name]);

  return {
    name,
    setName,
    nameMaxLength: PORTAL_PROFILE_VALUE_MAX,
    office: context?.tenantName ?? '',
    email: user?.email ?? '',
    saving,
    saved,
    failed,
    save,
  };
};
