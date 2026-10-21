import { useCallback, useMemo, useState } from 'react';
import { useSettings } from '../../../../../../stores/useSettings';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useLabel, useT } from '../../../../../shared/i18n/useT';
import { usePointContributions } from '../../../../../shared/extensions/usePointContributions';
import {
  asNotificationCategory,
  NOTIFICATION_CATEGORY_POINT,
  notificationCategoryId,
} from '../../../../../../domain/schema/notifications';
import {
  asNotificationEmailLayout,
  asNotificationTemplates,
  BUILTIN_NOTIFICATION_VARIABLES,
  buildNotificationEmailHtml,
  fillNotificationTemplate,
  GENERAL_NOTIFICATION_TEMPLATE,
  NOTIFICATION_EMAIL_LAYOUT_SETTING,
  NOTIFICATION_TEMPLATES_SETTING,
  type NotificationChannelTemplates,
  type NotificationTemplateChannel,
  type NotificationTemplates,
} from '../../../../../../domain/schema/notificationTemplate';

/** Os dois campos de cada canal, na ordem da tela. */
const CHANNEL_FIELDS: Record<NotificationTemplateChannel, [string, string]> = {
  email: ['subject', 'body'],
  inApp: ['title', 'message'],
  push: ['title', 'body'],
};

const FIELD_LIMITS: Record<NotificationTemplateChannel, [number, number]> = {
  email: [200, 4000],
  inApp: [200, 1000],
  push: [80, 200],
};

export interface TemplateFieldView {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
  max: number;
}

export interface NotificationTemplatesViewModel {
  types: Array<{ value: string; label: string }>;
  type: string;
  setType: (type: string) => void;
  channel: NotificationTemplateChannel;
  channels: Array<{ key: NotificationTemplateChannel; label: string; customized: boolean }>;
  setChannel: (channel: NotificationTemplateChannel) => void;
  fields: TemplateFieldView[];
  setField: (key: string, value: string) => void;
  /** Põe `{variável}` no fim do campo em foco (ou do último usado). */
  insertVariable: (variable: string) => void;
  focusField: (key: string) => void;
  variables: string[];
  channelHint: string;
  customized: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  discard: () => void;
  reset: () => void;
  preview: { kind: 'email'; html: string } | { kind: 'card'; title: string; body: string; channel: NotificationTemplateChannel };
}

const sample = (variable: string) => `‹${variable}›`;

export const useNotificationTemplatesViewModel = (): NotificationTemplatesViewModel => {
  const { values, setValue } = useSettings();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const t = useT('core.automation');
  const label = useLabel();
  const contributions = usePointContributions(NOTIFICATION_CATEGORY_POINT);

  const categories = useMemo(() => contributions.flatMap((contribution) => {
    const metadata = asNotificationCategory(contribution.metadata);
    return metadata
      ? [{ id: notificationCategoryId(contribution.pluginId, metadata.key), title: label(metadata.title), variables: metadata.variables ?? [] }]
      : [];
  }), [contributions, label]);

  const saved = useMemo(() => asNotificationTemplates(values.tenant[NOTIFICATION_TEMPLATES_SETTING]), [values.tenant]);
  const layout = useMemo(() => asNotificationEmailLayout(values.tenant[NOTIFICATION_EMAIL_LAYOUT_SETTING]), [values.tenant]);

  const [type, setTypeState] = useState(GENERAL_NOTIFICATION_TEMPLATE);
  const [channel, setChannelState] = useState<NotificationTemplateChannel>('email');
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [focused, setFocused] = useState<string>(CHANNEL_FIELDS.email[1]);
  const [saving, setSaving] = useState(false);

  const savedEntry = saved[type]?.[channel] as Record<string, string> | undefined;
  const current = useMemo<Record<string, string>>(() => draft ?? savedEntry ?? {}, [draft, savedEntry]);

  const fieldLabels: Record<string, string> = {
    subject: t('notifications.templates.field.subject'),
    body: t('notifications.templates.field.body'),
    title: t('notifications.templates.field.title'),
    message: t('notifications.templates.field.message'),
  };

  const fields = CHANNEL_FIELDS[channel].map((key, index) => ({
    key,
    label: fieldLabels[key],
    value: current[key] ?? '',
    multiline: index === 1,
    max: FIELD_LIMITS[channel][index],
  }));

  const variables = useMemo(() => [
    ...BUILTIN_NOTIFICATION_VARIABLES,
    ...(categories.find((one) => one.id === type)?.variables ?? []),
  ], [categories, type]);

  // Trocar de tipo ou canal com alteração pendente descarta a alteração: a tela edita um canal por vez.
  const setType = useCallback((next: string) => {
    setTypeState(next);
    setDraft(null);
  }, []);
  const setChannel = useCallback((next: NotificationTemplateChannel) => {
    setChannelState(next);
    setDraft(null);
    setFocused(CHANNEL_FIELDS[next][1]);
  }, []);

  const setField = useCallback((key: string, value: string) => {
    setDraft((previous) => ({ ...(previous ?? savedEntry ?? {}), [key]: value }));
  }, [savedEntry]);

  const insertVariable = useCallback((variable: string) => {
    const key = focused;
    setDraft((previous) => {
      const base = previous ?? savedEntry ?? {};
      const value = base[key] ?? '';
      return { ...base, [key]: `${value}${value && !value.endsWith(' ') ? ' ' : ''}{${variable}}` };
    });
  }, [focused, savedEntry]);

  const persist = useCallback((next: NotificationTemplates, message: string) => {
    setSaving(true);
    setValue('tenant', NOTIFICATION_TEMPLATES_SETTING, next)
      .then(() => {
        setDraft(null);
        notify(message, 'success');
      })
      .catch(() => notify(t('notifications.templates.failed'), 'error'))
      .finally(() => setSaving(false));
  }, [setValue, notify, t]);

  const save = useCallback(() => {
    if (!draft) return;
    const entry = draft;
    const [first, second] = CHANNEL_FIELDS[channel];
    const empty = !(entry[first] ?? '').trim() && !(entry[second] ?? '').trim();
    const nextType: NotificationChannelTemplates = { ...(saved[type] ?? {}) };
    if (empty) delete nextType[channel];
    else (nextType as Record<string, unknown>)[channel] = { [first]: entry[first] ?? '', [second]: entry[second] ?? '' };
    const next: NotificationTemplates = { ...saved };
    if (Object.keys(nextType).length === 0) delete next[type];
    else next[type] = nextType;
    persist(next, t('notifications.templates.saved'));
  }, [draft, channel, saved, type, persist, t]);

  const reset = useCallback(() => {
    const nextType: NotificationChannelTemplates = { ...(saved[type] ?? {}) };
    delete nextType[channel];
    const next: NotificationTemplates = { ...saved };
    if (Object.keys(nextType).length === 0) delete next[type];
    else next[type] = nextType;
    persist(next, t('notifications.templates.reset.done'));
  }, [saved, type, channel, persist, t]);

  const tenantName = currentTenant?.name ?? '';
  const preview = useMemo<NotificationTemplatesViewModel['preview']>(() => {
    const samples = Object.fromEntries(variables.map((variable) => [variable, sample(variable)]));
    const sampleVars = { ...samples, tenant: tenantName || sample('tenant') };
    const [first, second] = CHANNEL_FIELDS[channel];
    const head = fillNotificationTemplate(current[first] || '{title}', sampleVars);
    const tail = fillNotificationTemplate(current[second] || '{message}', sampleVars);
    if (channel !== 'email') return { kind: 'card', title: head, body: tail, channel };
    return {
      kind: 'email',
      html: buildNotificationEmailHtml({
        title: head,
        body: tail,
        linkUrl: '#',
        linkLabel: t('notifications.email.open'),
        footer: layout.footer
          ? fillNotificationTemplate(layout.footer, sampleVars)
          : t('notifications.email.footer', { tenant: tenantName }),
        tenantName,
        logoURL: currentTenant?.logoURL ?? null,
        layout,
      }),
    };
  }, [variables, tenantName, channel, current, layout, t, currentTenant]);

  const channelLabels: Record<NotificationTemplateChannel, string> = {
    email: t('notifications.page.preferences.channel.email'),
    inApp: t('notifications.page.preferences.channel.in-app'),
    push: t('notifications.page.preferences.channel.push'),
  };
  const channelHints: Record<NotificationTemplateChannel, string> = {
    email: t('notifications.templates.hint.email'),
    inApp: t('notifications.templates.hint.in-app'),
    push: t('notifications.templates.hint.push'),
  };

  return {
    types: [
      { value: GENERAL_NOTIFICATION_TEMPLATE, label: t('notifications.templates.type.general') },
      ...categories.map((one) => ({ value: one.id, label: one.title })),
    ],
    type,
    setType,
    channel,
    channels: (['email', 'inApp', 'push'] as NotificationTemplateChannel[]).map((key) => ({
      key,
      label: channelLabels[key],
      customized: !!saved[type]?.[key],
    })),
    setChannel,
    fields,
    setField,
    insertVariable,
    focusField: setFocused,
    variables,
    channelHint: channelHints[channel],
    customized: !!savedEntry,
    dirty: draft !== null,
    saving,
    save,
    discard: () => setDraft(null),
    reset,
    preview,
  };
};
