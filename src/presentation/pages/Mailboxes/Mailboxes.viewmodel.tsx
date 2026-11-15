import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useNotification } from '../../../stores/useNotification';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useLabel, useLocaleFormat, useT } from '../../shared/i18n/useT';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
import { PERMISSION_MAILBOXES_MANAGE } from '../../../domain/schema/access';
import {
  DEFAULT_IMAP_FOLDER,
  EMPTY_MAILBOX_SETTINGS,
  MAILBOX_MAX_BACKFILL_DAYS,
  MAILBOX_MAX_POLL_MINUTES,
  MAILBOX_MIN_POLL_MINUTES,
  MAIL_RECEIVED_EVENT,
  isPolledMailbox,
  mailboxSettingsIssue,
} from '../../../domain/schema/mailbox';
import type { ForwardingRule, MailboxSettings, MailboxSource, MailboxView } from '../../../domain/schema/mailbox';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { makeManageMailboxUseCase } from '../../../domain/usecases/mailboxes/ManageMailboxUseCase';
import type { MultiSearchSelectOption } from '../../components/ui/MultiSearchSelect';

export type MailboxScope = 'own' | 'office';
export type MailboxTone = 'ok' | 'failing' | 'pending' | 'off';

export interface MailboxForm {
  name: string;
  source: MailboxSource;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  folder: string;
  password: string;
  pollEveryMinutes: string;
  backfillDays: string;
  subscriptions: string[];
  enabled: boolean;
  scope: MailboxScope;
}

export type MailboxTextField = 'name' | 'host' | 'port' | 'username' | 'folder' | 'password' | 'pollEveryMinutes' | 'backfillDays';

export interface MailboxCard {
  mailbox: MailboxView;
  /** A conta lida (IMAP) ou o endereço para onde encaminhar. */
  account: string;
  /** O endereço, para copiar — só na caixa de encaminhamento. */
  address: string | null;
  /** A confirmação de encaminhamento pendente, já em frase. */
  confirmation: { text: string; url: string } | null;
  /** O passo a passo do encaminhamento — só na caixa `forward` com endereço. */
  guide: { address: string; rule: ForwardingRule | null } | null;
  guideOpen: boolean;
  canTest: boolean;
  owner: string | null;
  tone: MailboxTone;
  status: string;
  subscriptions: string;
}

export interface MailboxSection {
  key: 'own' | 'office' | 'members';
  title: string;
  cards: MailboxCard[];
}

export interface MailboxesViewModel {
  loading: boolean;
  sections: MailboxSection[];
  canManage: boolean;
  noSubscribableWorkflows: boolean;
  forwardingAvailable: boolean;
  sourceOptions: SearchSelectOption[];
  isPolled: boolean;
  modalOpen: boolean;
  editing: MailboxView | null;
  form: MailboxForm;
  issue: string | null;
  saving: boolean;
  testingId: string | null;
  pendingDelete: MailboxView | null;
  subscriptionOptions: MultiSearchSelectOption[];
  openNew: (scope: MailboxScope) => void;
  openEdit: (mailbox: MailboxView) => void;
  closeModal: () => void;
  setText: (field: MailboxTextField, value: string) => void;
  setSource: (value: string) => void;
  setSecure: (value: boolean) => void;
  setEnabled: (value: boolean) => void;
  setSubscriptions: (values: string[]) => void;
  save: () => Promise<void>;
  test: (mailbox: MailboxView) => Promise<void>;
  toggleGuide: (card: MailboxCard) => void;
  askDelete: (mailbox: MailboxView) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

const EMPTY_FORM: MailboxForm = {
  name: '',
  source: 'imap',
  host: '',
  port: String(EMPTY_MAILBOX_SETTINGS.imap.port),
  secure: EMPTY_MAILBOX_SETTINGS.imap.secure,
  username: '',
  folder: DEFAULT_IMAP_FOLDER,
  password: '',
  pollEveryMinutes: String(EMPTY_MAILBOX_SETTINGS.pollEveryMinutes),
  backfillDays: '0',
  subscriptions: [],
  enabled: true,
  scope: 'own',
};

const formOf = (mailbox: MailboxView): MailboxForm => ({
  name: mailbox.name,
  source: mailbox.source,
  host: mailbox.imap.host,
  port: String(mailbox.imap.port),
  secure: mailbox.imap.secure,
  username: mailbox.imap.username,
  folder: mailbox.imap.folder,
  password: '',
  pollEveryMinutes: String(mailbox.pollEveryMinutes),
  backfillDays: String(mailbox.backfillDays),
  subscriptions: mailbox.subscriptions,
  enabled: mailbox.enabled,
  scope: mailbox.ownerId === null ? 'office' : 'own',
});

const settingsOf = (form: MailboxForm): MailboxSettings => ({
  name: form.name.trim(),
  source: form.source,
  imap: {
    host: form.host.trim(),
    port: Number(form.port),
    secure: form.secure,
    username: form.username.trim(),
    folder: form.folder.trim() || DEFAULT_IMAP_FOLDER,
  },
  pollEveryMinutes: Number(form.pollEveryMinutes),
  backfillDays: Number(form.backfillDays),
  subscriptions: form.subscriptions,
  enabled: form.enabled,
});

export const useMailboxesViewModel = (): MailboxesViewModel => {
  const { mailboxService } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { workflows } = useWorkflowStore();
  const t = useT('core.automation');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();

  const uc = useMemo(() => makeManageMailboxUseCase(mailboxService), [mailboxService]);
  const tenantId = currentTenant?.id ?? '';
  const userId = user?.id ?? '';
  const canManage = can(PERMISSION_MAILBOXES_MANAGE);

  const [mailboxes, setMailboxes] = useState<MailboxView[]>([]);
  const [forwardingAvailable, setForwardingAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MailboxView | null>(null);
  const [form, setForm] = useState<MailboxForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MailboxView | null>(null);
  // Só o que a pessoa abriu ou fechou: sem isso, o guia segue o estado da caixa.
  const [guideToggles, setGuideToggles] = useState<Record<string, boolean>>({});

  const fail = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    notify(label(message, errorParamsOf(error)), 'error');
  }, [notify, label]);

  // Salvar ou remover não devolve a lista: a callable é a fonte da verdade (saúde, dono, próximo prazo), e
  // pedir de novo é mudar esta versão.
  const [listVersion, setListVersion] = useState(0);
  const reload = useCallback(() => setListVersion((current) => current + 1), []);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    uc.list(tenantId)
      .then((loaded) => {
        if (cancelled) return;
        setMailboxes(loaded.mailboxes);
        setForwardingAvailable(loaded.forwardingAvailable);
      })
      .catch((error) => { if (!cancelled) fail(error); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, uc, fail, listVersion]);

  const mailWorkflows = useMemo(() => workflows.filter((workflow) => workflow.eventName === MAIL_RECEIVED_EVENT), [workflows]);
  const workflowName = useCallback(
    (id: string) => mailWorkflows.find((workflow) => workflow.id === id)?.name ?? id,
    [mailWorkflows],
  );

  // A caixa de um membro só assina o que o escritório marcou como assinável; a do escritório, qualquer uma.
  const subscriptionOptions = useMemo<MultiSearchSelectOption[]>(() => {
    const personal = editing ? editing.ownerId !== null : form.scope === 'own';
    return mailWorkflows
      .filter((workflow) => !personal || workflow.subscribable === true || form.subscriptions.includes(workflow.id))
      .map((workflow) => ({ value: workflow.id, label: workflow.name, ...(workflow.enabled ? {} : { meta: t('mailbox.workflow-disabled') }) }));
  }, [mailWorkflows, editing, form.scope, form.subscriptions, t]);

  const cardOf = useCallback((mailbox: MailboxView): MailboxCard => {
    const failure = mailbox.health.failure;
    const polled = isPolledMailbox(mailbox.source);
    const tone: MailboxTone = !mailbox.enabled ? 'off' : failure ? 'failing' : mailbox.health.lastPolledAt ? 'ok' : 'pending';
    const lastAt = mailbox.health.lastPolledAt ? formatDateTime(mailbox.health.lastPolledAt) : '';
    const status = tone === 'off'
      ? t('mailbox.status.off')
      : failure
        ? label(`@core.automation/mailbox.failure.${failure.reason}`, { name: mailbox.name, detail: failure.message })
        : !mailbox.health.lastPolledAt
          ? t(polled ? 'mailbox.status.pending' : 'mailbox.status.forward-pending')
          : polled
            ? mailbox.health.lastDeliveredAt
              ? t('mailbox.status.ok', { when: lastAt, delivered: formatDateTime(mailbox.health.lastDeliveredAt) })
              : t('mailbox.status.ok-none', { when: lastAt })
            : t('mailbox.status.forward-ok', { when: lastAt });
    const pending = mailbox.forwardingConfirmation;
    // Aberto enquanto o encaminhamento não está de pé — nada chegou ainda, ou a confirmação espera. Depois,
    // fecha sozinho e fica a um clique.
    const settingUp = !mailbox.health.lastPolledAt || pending !== null;
    return {
      mailbox,
      account: polled
        ? `${mailbox.imap.username} · ${mailbox.imap.host} · ${mailbox.imap.folder}`
        : mailbox.address ?? t('mailbox.forward.unavailable'),
      address: polled ? null : mailbox.address,
      confirmation: pending
        ? {
            text: pending.code
              ? t('mailbox.forward.confirmation', { code: pending.code })
              : t('mailbox.forward.confirmation-link'),
            url: pending.url,
          }
        : null,
      guide: !polled && mailbox.address ? { address: mailbox.address, rule: mailbox.forwardingRule } : null,
      guideOpen: !polled && mailbox.address !== null && (guideToggles[mailbox.id] ?? settingUp),
      canTest: polled,
      owner: mailbox.ownerName,
      tone,
      status,
      subscriptions: mailbox.subscriptions.length > 0
        ? mailbox.subscriptions.map(workflowName).join(', ')
        : t('mailbox.no-subscriptions'),
    };
  }, [t, label, formatDateTime, workflowName, guideToggles]);

  const toggleGuide = useCallback((card: MailboxCard) => {
    setGuideToggles((current) => ({ ...current, [card.mailbox.id]: !card.guideOpen }));
  }, []);

  const sections = useMemo<MailboxSection[]>(() => {
    const own = mailboxes.filter((mailbox) => mailbox.ownerId === userId).map(cardOf);
    const office = mailboxes.filter((mailbox) => mailbox.ownerId === null).map(cardOf);
    const members = mailboxes.filter((mailbox) => mailbox.ownerId !== null && mailbox.ownerId !== userId).map(cardOf);
    return [
      { key: 'own' as const, title: t('mailbox.section.own'), cards: own },
      ...(canManage ? [{ key: 'office' as const, title: t('mailbox.section.office'), cards: office }] : []),
      ...(canManage && members.length > 0 ? [{ key: 'members' as const, title: t('mailbox.section.members'), cards: members }] : []),
    ];
  }, [mailboxes, userId, canManage, cardOf, t]);

  const settings = useMemo(() => settingsOf(form), [form]);
  const isPolled = isPolledMailbox(form.source);
  const found = useMemo(() => {
    const settingsIssue = mailboxSettingsIssue(settings);
    if (settingsIssue) return settingsIssue;
    if (isPolled && !form.password && !editing?.hasPassword) return '@core.automation/mailbox.issue.password';
    if (!isPolled && !forwardingAvailable) return '@core.automation/mailbox.issue.forwarding-unavailable';
    return null;
  }, [settings, editing, form.password, isPolled, forwardingAvailable]);

  // A fonte de encaminhamento só é oferecida quando a instalação recebe e-mail; a caixa que já é de
  // encaminhamento continua mostrando a dela, para a tela não mentir sobre o que está gravado.
  const sourceOptions = useMemo<SearchSelectOption[]>(() => [
    { value: 'imap', label: t('mailbox.source.imap') },
    ...(forwardingAvailable || form.source === 'forward' ? [{ value: 'forward', label: t('mailbox.source.forward') }] : []),
  ], [forwardingAvailable, form.source, t]);
  const setSource = useCallback((value: string) => {
    setForm((current) => ({ ...current, source: value === 'forward' ? 'forward' : 'imap' }));
  }, []);
  const touched = form.name !== '' || form.host !== '' || editing !== null;
  const issue = found && touched
    ? label(found, { min: String(MAILBOX_MIN_POLL_MINUTES), max: String(MAILBOX_MAX_POLL_MINUTES), days: String(MAILBOX_MAX_BACKFILL_DAYS) })
    : null;

  const openNew = useCallback((scope: MailboxScope) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, scope });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((mailbox: MailboxView) => {
    setEditing(mailbox);
    setForm(formOf(mailbox));
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const setText = useCallback((field: MailboxTextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);
  const setSecure = useCallback((value: boolean) => {
    setForm((current) => ({ ...current, secure: value, port: current.port === (value ? '143' : '993') ? (value ? '993' : '143') : current.port }));
  }, []);
  const setEnabled = useCallback((value: boolean) => setForm((current) => ({ ...current, enabled: value })), []);
  const setSubscriptions = useCallback((values: string[]) => setForm((current) => ({ ...current, subscriptions: values })), []);

  const save = useCallback(async () => {
    if (!tenantId || found) return;
    setSaving(true);
    try {
      await uc.save(tenantId, { id: editing?.id ?? null, scope: form.scope, settings, password: form.password });
      notify(t('mailbox.saved'), 'success');
      setModalOpen(false);
      setEditing(null);
      reload();
    } catch (error) {
      fail(error);
    } finally {
      setSaving(false);
    }
  }, [tenantId, found, uc, editing, form.scope, form.password, settings, notify, t, reload, fail]);

  const test = useCallback(async (mailbox: MailboxView) => {
    if (!tenantId) return;
    setTestingId(mailbox.id);
    try {
      await uc.test(tenantId, mailbox.id);
      notify(t('mailbox.test.ok', { name: mailbox.name }), 'success');
    } catch (error) {
      fail(error);
    } finally {
      setTestingId(null);
    }
  }, [tenantId, uc, notify, t, fail]);

  const askDelete = useCallback((mailbox: MailboxView) => setPendingDelete(mailbox), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);
  const confirmDelete = useCallback(async () => {
    if (!tenantId || !pendingDelete) return;
    try {
      await uc.remove(tenantId, pendingDelete.id);
      notify(t('mailbox.deleted'), 'success');
      reload();
    } catch (error) {
      fail(error);
    } finally {
      setPendingDelete(null);
    }
  }, [tenantId, pendingDelete, uc, notify, t, reload, fail]);

  return {
    loading,
    sections,
    canManage,
    noSubscribableWorkflows: !mailWorkflows.some((workflow) => workflow.subscribable === true),
    forwardingAvailable,
    sourceOptions,
    isPolled,
    modalOpen,
    editing,
    form,
    issue,
    saving,
    testingId,
    pendingDelete,
    subscriptionOptions,
    openNew,
    openEdit,
    closeModal,
    setText,
    setSource,
    setSecure,
    setEnabled,
    setSubscriptions,
    save,
    test,
    toggleGuide,
    askDelete,
    cancelDelete,
    confirmDelete,
  };
};
