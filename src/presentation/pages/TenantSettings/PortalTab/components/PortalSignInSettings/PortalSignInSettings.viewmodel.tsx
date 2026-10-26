import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useDI } from '../../../../../../infrastructure/di/useDI';
import { useLabel, useT } from '../../../../../shared/i18n/useT';
import {
  makeGetPortalSignInSettingsUseCase,
  makeSavePortalSignInSettingsUseCase,
} from '../../../../../../domain/usecases/portal/PortalSignInUseCases';
import type { PortalSignInSettingsView } from '../../../../../../domain/entities/Portal';
import {
  PORTAL_IDENTITY_PROVIDERS_MAX,
  PORTAL_SIGN_IN_CALLBACK_PATH,
  type PortalIdentityProvider,
} from '../../../../../../domain/schema/portalIdentity';

/** Um provedor como a aba o edita: listas como texto, e o segredo só quando alguém o digita. */
export interface PortalProviderDraft {
  key: string;
  id: string;
  label: string;
  issuer: string;
  clientId: string;
  scopes: string;
  claims: string;
  levelClaim: string;
  userInfo: boolean;
  /** O segredo novo — vazio é "não mexer". */
  secret: string;
  hasSecret: boolean;
  clearSecret: boolean;
}

export interface PortalSignInSettingsViewModel {
  loading: boolean;
  saving: boolean;
  emailLink: boolean;
  setEmailLink: (value: boolean) => void;
  providers: PortalProviderDraft[];
  canAddProvider: boolean;
  addProvider: () => void;
  removeProvider: (key: string) => void;
  updateProvider: (key: string, patch: Partial<PortalProviderDraft>) => void;
  /** O endereço de volta que o escritório registra no cliente OIDC. */
  callbackUrl: string;
  save: () => Promise<void>;
}

const listOf = (text: string): string[] => text.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);

const draftOf = (key: string, provider: PortalSignInSettingsView['providers'][number]): PortalProviderDraft => ({
  key,
  id: provider.id,
  label: provider.label,
  issuer: provider.issuer,
  clientId: provider.clientId,
  scopes: provider.scopes.join(' '),
  claims: provider.claims.join(', '),
  levelClaim: provider.levelClaim ?? '',
  userInfo: provider.userInfo === true,
  secret: '',
  hasSecret: provider.hasSecret,
  clearSecret: false,
});

const providerOf = (draft: PortalProviderDraft): PortalIdentityProvider => ({
  id: draft.id.trim(),
  label: draft.label.trim(),
  issuer: draft.issuer.trim(),
  clientId: draft.clientId.trim(),
  scopes: listOf(draft.scopes),
  claims: listOf(draft.claims),
  ...(draft.levelClaim.trim() ? { levelClaim: draft.levelClaim.trim() } : {}),
  ...(draft.userInfo ? { userInfo: true } : {}),
});

/**
 * Configurações › Portal › Entrada: se o link de e-mail vale, e os provedores de identidade do
 * escritório. O segredo do cliente nunca chega aqui — a aba sabe só SE ele existe, e manda o novo
 * quando alguém o digita.
 */
export const usePortalSignInSettingsViewModel = (onSaved?: () => void): PortalSignInSettingsViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const { portalRepository } = useDI();
  const tenantId = currentTenant?.id ?? null;

  const uc = useMemo(() => ({
    get: makeGetPortalSignInSettingsUseCase(portalRepository),
    save: makeSavePortalSignInSettingsUseCase(portalRepository),
  }), [portalRepository]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailLink, setEmailLink] = useState(true);
  const [providers, setProviders] = useState<PortalProviderDraft[]>([]);
  const nextKey = useRef(0);
  const [callbackUrl] = useState(() => `${window.location.origin}${PORTAL_SIGN_IN_CALLBACK_PATH}`);

  const load = useCallback((view: PortalSignInSettingsView) => {
    setEmailLink(view.emailLink);
    setProviders(view.providers.map((provider) => {
      nextKey.current += 1;
      return draftOf(`p${nextKey.current}`, provider);
    }));
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.get.execute(tenantId)
      .then((view) => { if (active) load(view); })
      .catch(() => { if (active) notify(t('portal.identity.load-failed'), 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, uc.get, load, notify, t]);

  const addProvider = useCallback(() => {
    nextKey.current += 1;
    const key = `p${nextKey.current}`;
    setProviders((current) => [...current, {
      key, id: '', label: '', issuer: '', clientId: '', scopes: '', claims: '', levelClaim: '', userInfo: false,
      secret: '', hasSecret: false, clearSecret: false,
    }]);
  }, []);

  const removeProvider = useCallback((key: string) => {
    setProviders((current) => current.filter((provider) => provider.key !== key));
  }, []);

  const updateProvider = useCallback((key: string, patch: Partial<PortalProviderDraft>) => {
    setProviders((current) => current.map((provider) => (provider.key === key ? { ...provider, ...patch } : provider)));
  }, []);

  const save = useCallback(async () => {
    if (!tenantId) return;
    setSaving(true);
    const secrets: Record<string, string | null> = {};
    for (const draft of providers) {
      const id = draft.id.trim();
      if (draft.secret.trim()) secrets[id] = draft.secret.trim();
      else if (draft.clearSecret) secrets[id] = null;
    }
    try {
      load(await uc.save.execute(tenantId, { emailLink, providers: providers.map(providerOf) }, secrets));
      notify(t('portal.identity.saved'), 'success');
      onSaved?.();
    } catch (error) {
      notify(label(error instanceof Error ? error.message : '@core.tenant/portal.failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [tenantId, providers, emailLink, uc.save, load, notify, t, label, onSaved]);

  return {
    loading,
    saving,
    emailLink,
    setEmailLink,
    providers,
    canAddProvider: providers.length < PORTAL_IDENTITY_PROVIDERS_MAX,
    addProvider,
    removeProvider,
    updateProvider,
    callbackUrl,
    save,
  };
};
