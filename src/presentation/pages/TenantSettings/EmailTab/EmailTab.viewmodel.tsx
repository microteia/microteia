import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';
import { useLabel } from '../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../../../../domain/schema/notifications';
import { EMPTY_NOTIFICATION_EMAIL_SETTINGS, notificationEmailSettingsIssue } from '../../../../domain/schema/notifications';
import { makeManageNotificationEmailUseCase } from '../../../../domain/usecases/notifications/ManageNotificationEmailUseCase';

type TextField = 'host' | 'username' | 'fromAddress' | 'fromName' | 'appUrl';

export interface EmailTabViewModel {
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  configured: boolean;
  hasPassword: boolean;
  form: NotificationEmailSettings;
  portText: string;
  password: string;
  issue: string | null;
  canSave: boolean;
  confirmClearOpen: boolean;
  setText: (field: TextField, value: string) => void;
  setPort: (value: string) => void;
  setSecure: (value: boolean) => void;
  setPassword: (value: string) => void;
  save: () => void;
  sendTest: () => void;
  askClear: () => void;
  cancelClear: () => void;
  confirmClear: () => Promise<void>;
}

const formOf = (view: NotificationEmailSettingsView, origin: string): NotificationEmailSettings => ({
  host: view.host,
  port: view.port,
  secure: view.secure,
  username: view.username,
  fromAddress: view.fromAddress,
  fromName: view.fromName,
  appUrl: view.appUrl || origin,
});

export const useEmailTabViewModel = (): EmailTabViewModel => {
  const { notificationEmailService } = useDI();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const label = useLabel();

  const uc = useMemo(() => makeManageNotificationEmailUseCase(notificationEmailService), [notificationEmailService]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [view, setView] = useState<NotificationEmailSettingsView | null>(null);
  const [form, setForm] = useState<NotificationEmailSettings>(EMPTY_NOTIFICATION_EMAIL_SETTINGS);
  const [portText, setPortText] = useState(String(EMPTY_NOTIFICATION_EMAIL_SETTINGS.port));
  const [password, setPassword] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const tenantId = currentTenant?.id ?? '';

  const fail = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    notify(label(message, errorParamsOf(error)), 'error');
  }, [notify, label]);

  const apply = useCallback((next: NotificationEmailSettingsView) => {
    const loaded = formOf(next, window.location.origin);
    setView(next);
    setForm(loaded);
    setPortText(String(loaded.port));
    setPassword('');
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

  const setText = useCallback((field: TextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const setPort = useCallback((value: string) => {
    setPortText(value);
    setForm((current) => ({ ...current, port: Number(value) }));
  }, []);

  const setSecure = useCallback((value: boolean) => {
    setForm((current) => ({ ...current, secure: value }));
  }, []);

  const found = useMemo(() => notificationEmailSettingsIssue(form), [form]);
  const touched = form.host !== '' || (view?.configured ?? false);
  const issue = found && touched ? label(found) : null;

  const save = useCallback(() => {
    if (!tenantId) return;
    setIsSaving(true);
    uc.save(tenantId, form, password)
      .then((saved) => {
        apply(saved);
        notify(label('@core.automation/notifications.email.saved'), 'success');
      })
      .catch(fail)
      .finally(() => setIsSaving(false));
  }, [tenantId, uc, form, password, apply, notify, label, fail]);

  const sendTest = useCallback(() => {
    if (!tenantId) return;
    setIsTesting(true);
    uc.sendTest(tenantId)
      .then((sentTo) => notify(label('@core.automation/notifications.email.test.sent', { email: sentTo }), 'success'))
      .catch(fail)
      .finally(() => setIsTesting(false));
  }, [tenantId, uc, notify, label, fail]);

  const askClear = useCallback(() => setConfirmClearOpen(true), []);
  const cancelClear = useCallback(() => setConfirmClearOpen(false), []);

  const confirmClear = useCallback(async () => {
    if (!tenantId) return;
    try {
      apply(await uc.clear(tenantId));
      notify(label('@core.automation/notifications.email.cleared'), 'success');
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
    hasPassword: view?.hasPassword ?? false,
    form,
    portText,
    password,
    issue,
    canSave: found === null && !isSaving,
    confirmClearOpen,
    setText,
    setPort,
    setSecure,
    setPassword,
    save,
    sendTest,
    askClear,
    cancelClear,
    confirmClear,
  };
};
