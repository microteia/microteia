import { useCallback, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { useSettings } from '../../../../../../stores/useSettings';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useT } from '../../../../../shared/i18n/useT';
import {
  asNotificationEmailLayout,
  buildNotificationEmailHtml,
  NOTIFICATION_EMAIL_LAYOUT_SETTING,
  type NotificationEmailLayout,
} from '../../../../../../domain/schema/notificationTemplate';

export interface EmailAppearanceViewModel {
  layout: NotificationEmailLayout;
  /** O escritório tem logo cadastrado — sem ele, a opção não tem o que mostrar. */
  hasLogo: boolean;
  accentOptions: Array<{ label: string; value: string }>;
  dirty: boolean;
  saving: boolean;
  previewHtml: string;
  setShowLogo: (show: boolean) => void;
  setAccent: (color: string) => void;
  setSignature: (value: string) => void;
  setFooter: (value: string) => void;
  save: () => void;
  discard: () => void;
}

/** O layout de TODO e-mail do escritório, com a pré-visualização feita pelo mesmo código do envio. */
export const useEmailAppearanceViewModel = (): EmailAppearanceViewModel => {
  const { values, setValue } = useSettings();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const theme = useTheme();
  const t = useT('core.automation');

  const saved = useMemo(() => asNotificationEmailLayout(values.tenant[NOTIFICATION_EMAIL_LAYOUT_SETTING]), [values.tenant]);
  const [draft, setDraft] = useState<NotificationEmailLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const layout = draft ?? saved;

  const change = useCallback((patch: Partial<NotificationEmailLayout>) => {
    setDraft((current) => ({ ...(current ?? saved), ...patch }));
  }, [saved]);

  const tenantName = currentTenant?.name ?? '';
  const previewHtml = useMemo(() => buildNotificationEmailHtml({
    title: t('notifications.appearance.preview.title'),
    body: t('notifications.appearance.preview.body'),
    linkUrl: '#',
    linkLabel: t('notifications.email.open'),
    footer: layout.footer
      ? layout.footer.replace(/\{tenant\}/g, tenantName)
      : t('notifications.email.footer', { tenant: tenantName }),
    tenantName,
    logoURL: currentTenant?.logoURL ?? null,
    layout,
  }), [layout, t, tenantName, currentTenant]);

  const save = useCallback(() => {
    if (!draft) return;
    setSaving(true);
    setValue('tenant', NOTIFICATION_EMAIL_LAYOUT_SETTING, draft)
      .then(() => {
        setDraft(null);
        notify(t('notifications.appearance.saved'), 'success');
      })
      .catch(() => notify(t('notifications.appearance.failed'), 'error'))
      .finally(() => setSaving(false));
  }, [draft, setValue, notify, t]);

  return {
    layout,
    hasLogo: !!currentTenant?.logoURL,
    // A cor do e-mail é DADO do escritório (vai para uma caixa de correio, não para o tema): as
    // opções são a paleta de etiquetas, já em hexadecimal; vazio é a cor padrão do e-mail.
    accentOptions: theme.tagColors.map((color) => ({ label: color.label, value: color.value })),
    dirty: draft !== null,
    saving,
    previewHtml,
    setShowLogo: (showLogo) => change({ showLogo }),
    setAccent: (accentColor) => change({ accentColor }),
    setSignature: (signature) => change({ signature }),
    setFooter: (footer) => change({ footer }),
    save,
    discard: () => setDraft(null),
  };
};
