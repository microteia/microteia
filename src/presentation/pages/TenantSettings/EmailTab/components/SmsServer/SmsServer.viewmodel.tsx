import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useLabel, useT } from '../../../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../../../domain/errors/LocalizedError';
import type { NotificationSmsSettings, NotificationSmsSettingsView, SmsProvider } from '../../../../../../domain/schema/notificationContacts';
import {
  EMPTY_NOTIFICATION_SMS_SETTINGS,
  notificationSmsSettingsIssue,
  SMS_PROVIDERS,
} from '../../../../../../domain/schema/notificationContacts';
import { makeManageNotificationSmsUseCase } from '../../../../../../domain/usecases/notifications/ManageNotificationSmsUseCase';
import type { SearchSelectOption } from '../../../../../components/ui/SearchSelect';

type TextField = 'accountSid' | 'fromNumber' | 'webhookUrl' | 'defaultCountryCode' | 'appUrl';

export interface SmsServerViewModel {
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  configured: boolean;
  hasSecret: boolean;
  isTwilio: boolean;
  form: NotificationSmsSettings;
  providerOptions: SearchSelectOption[];
  secret: string;
  issue: string | null;
  canSave: boolean;
  confirmClearOpen: boolean;
  setProvider: (value: string) => void;
  setText: (field: TextField, value: string) => void;
  setSecret: (value: string) => void;
  save: () => void;
  verify: () => void;
  askClear: () => void;
  cancelClear: () => void;
  confirmClear: () => Promise<void>;
}

const PROVIDER_LABELS: Record<SmsProvider, string> = {
  twilio: 'notifications.sms.provider.twilio',
  webhook: 'notifications.sms.provider.webhook',
};

const formOf = (view: NotificationSmsSettingsView, origin: string): NotificationSmsSettings => ({
  provider: view.provider,
  accountSid: view.accountSid,
  fromNumber: view.fromNumber,
  webhookUrl: view.webhookUrl,
  defaultCountryCode: view.defaultCountryCode,
  appUrl: view.appUrl || origin,
});

/**
 * O provedor de SMS do escritório. O segredo entra e nunca volta: o formulário só sabe SE ele existe.
 * O teste confere a credencial no provedor sem mandar mensagem — não há número a escolher.
 */
export const useSmsServerViewModel = (): SmsServerViewModel => {
  const { notificationSmsService } = useDI();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const label = useLabel();
  const t = useT('core.automation');

  const uc = useMemo(() => makeManageNotificationSmsUseCase(notificationSmsService), [notificationSmsService]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [view, setView] = useState<NotificationSmsSettingsView | null>(null);
  const [form, setForm] = useState<NotificationSmsSettings>(EMPTY_NOTIFICATION_SMS_SETTINGS);
  const [secret, setSecret] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const tenantId = currentTenant?.id ?? '';

  const fail = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    notify(label(message, errorParamsOf(error)), 'error');
  }, [notify, label]);

  const apply = useCallback((next: NotificationSmsSettingsView) => {
    setView(next);
    setForm(formOf(next, window.location.origin));
    setSecret('');
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    uc.get(tenantId)
      .then((loaded) => { if (!cancelled) apply(loaded); })
      .catch((error) => { if (!cancelled) fail(error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, uc, apply, fail]);

  const providerOptions = useMemo<SearchSelectOption[]>(
    () => SMS_PROVIDERS.map((provider) => ({ value: provider, label: t(PROVIDER_LABELS[provider]) })),
    [t],
  );

  const setProvider = useCallback((value: string) => {
    const provider = SMS_PROVIDERS.find((one) => one === value);
    if (provider) setForm((current) => ({ ...current, provider }));
  }, []);

  const setText = useCallback((field: TextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const found = useMemo(() => notificationSmsSettingsIssue(form), [form]);
  const touched = form.accountSid !== '' || form.webhookUrl !== '' || form.defaultCountryCode !== '' || (view?.configured ?? false);
  const issue = found && touched ? label(found) : null;

  const save = useCallback(() => {
    if (!tenantId) return;
    setIsSaving(true);
    uc.save(tenantId, form, secret)
      .then((saved) => {
        apply(saved);
        notify(label('@core.automation/notifications.sms.saved'), 'success');
      })
      .catch(fail)
      .finally(() => setIsSaving(false));
  }, [tenantId, uc, form, secret, apply, notify, label, fail]);

  const verify = useCallback(() => {
    if (!tenantId) return;
    setIsTesting(true);
    uc.verify(tenantId)
      .then(() => notify(label('@core.automation/notifications.sms.test.verified'), 'success'))
      .catch(fail)
      .finally(() => setIsTesting(false));
  }, [tenantId, uc, notify, label, fail]);

  const askClear = useCallback(() => setConfirmClearOpen(true), []);
  const cancelClear = useCallback(() => setConfirmClearOpen(false), []);

  const confirmClear = useCallback(async () => {
    if (!tenantId) return;
    try {
      apply(await uc.clear(tenantId));
      notify(label('@core.automation/notifications.sms.cleared'), 'success');
    } catch (error) {
      fail(error);
    } finally {
      setConfirmClearOpen(false);
    }
  }, [tenantId, uc, apply, notify, label, fail]);

  return {
    isLoading,
    isSaving,
    isTesting,
    configured: view?.configured ?? false,
    hasSecret: view?.hasSecret ?? false,
    isTwilio: form.provider === 'twilio',
    form,
    providerOptions,
    secret,
    issue,
    canSave: found === null && !isSaving,
    confirmClearOpen,
    setProvider,
    setText,
    setSecret,
    save,
    verify,
    askClear,
    cancelClear,
    confirmClear,
  };
};
