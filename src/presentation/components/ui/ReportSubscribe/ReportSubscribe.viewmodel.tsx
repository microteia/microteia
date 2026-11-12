import { useCallback, useMemo, useState } from 'react';
import { REPORT_FILE_FORMATS, isReportFileFormat } from '../../../../domain/schema/report/reportStep';
import type { ReportFileFormat } from '../../../../domain/schema/report/reportStep';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { useAuth } from '../../../../stores/useAuth';
import { useWorkflowStore } from '../../../../stores/useWorkflowStore';
import { useNotification } from '../../../../stores/useNotification';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import type { ReportDefinition } from '../../../../domain/entities/Report';
import {
  REPORT_ALERT_OPS,
  REPORT_SUBSCRIPTION_FREQUENCIES,
  alertableMeasures,
  buildReportSubscription,
} from '../../../../domain/services/reportSubscription';
import type { ReportAlertOp, ReportSubscriptionFrequency } from '../../../../domain/services/reportSubscription';

export interface ReportSubscribeProps {
  report: ReportDefinition;
  /** As respostas que o leitor deu aos filtros — a assinatura as repete em cada execução. */
  prompts: Record<string, unknown>;
  onClose: () => void;
}

interface Option {
  value: string;
  label: string;
}

export interface ReportSubscribeViewModel {
  title: string;
  name: string;
  setName: (value: string) => void;
  frequency: string;
  setFrequency: (value: string) => void;
  frequencyOptions: Option[];
  hour: string;
  setHour: (value: string) => void;
  hourOptions: Option[];
  recipients: string[];
  setRecipients: (values: string[]) => void;
  memberOptions: Option[];
  /** O relatório tem medida que um alerta pode vigiar. */
  canAlert: boolean;
  alertOn: boolean;
  setAlertOn: (value: boolean) => void;
  alertMeasure: string;
  setAlertMeasure: (value: string) => void;
  measureOptions: Option[];
  alertOp: string;
  setAlertOp: (value: string) => void;
  opOptions: Option[];
  alertValue: string;
  setAlertValue: (value: string) => void;
  /** O arquivo gravado em Downloads a cada execução; vazio = só o aviso. */
  file: string;
  setFile: (value: string) => void;
  fileOptions: Option[];
  /** A tarja que diz o que a assinatura carrega dos filtros de agora. */
  filtersNotice: string | null;
  error: string | null;
  canSave: boolean;
  isSaving: boolean;
  save: () => Promise<void>;
  labels: {
    name: string;
    frequency: string;
    hour: string;
    recipients: string;
    alert: string;
    measure: string;
    op: string;
    value: string;
    file: string;
    save: string;
  };
}

const OP_KEYS: Record<ReportAlertOp, string> = {
  '>': 'subscribe.op.gt',
  '>=': 'subscribe.op.gte',
  '<': 'subscribe.op.lt',
  '<=': 'subscribe.op.lte',
  '==': 'subscribe.op.eq',
  '!=': 'subscribe.op.neq',
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const isFrequency = (value: string): value is ReportSubscriptionFrequency =>
  (REPORT_SUBSCRIPTION_FREQUENCIES as readonly string[]).includes(value);

const isOp = (value: string): value is ReportAlertOp => (REPORT_ALERT_OPS as readonly string[]).includes(value);

/**
 * A assinatura de um relatório: o leitor escolhe quando e para quem, e a tela grava uma AUTOMAÇÃO
 * comum (`buildReportSubscription`). Depois de criada, ela é editada onde as automações são editadas —
 * aqui não existe uma segunda tela de agendamento.
 */
export const useReportSubscribeViewModel = ({ report, prompts, onClose }: ReportSubscribeProps): ReportSubscribeViewModel => {
  const t = useT('core.reports');
  const label = useLabel();
  const { user } = useAuth();
  const { createWorkflow } = useWorkflowStore();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();
  const references = useReferenceOptions();

  const reportTitle = label(report.title);
  const measures = useMemo(() => alertableMeasures(report.spec), [report.spec]);

  const [name, setName] = useState(reportTitle);
  const [frequency, setFrequency] = useState<ReportSubscriptionFrequency>('weekly');
  const [hour, setHour] = useState(8);
  const [recipients, setRecipients] = useState<string[]>(user?.id ? [user.id] : []);
  const [alertOn, setAlertOn] = useState(false);
  const [alertMeasure, setAlertMeasure] = useState(measures[0] ?? '');
  const [alertOp, setAlertOp] = useState<ReportAlertOp>('>');
  const [alertValue, setAlertValue] = useState('');
  const [file, setFile] = useState<ReportFileFormat | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const frequencyOptions = useMemo(
    () => REPORT_SUBSCRIPTION_FREQUENCIES.map((value) => ({ value, label: t(`subscribe.frequency.${value}`) })),
    [t],
  );
  const hourOptions = useMemo(
    () => HOURS.map((value) => ({ value: String(value), label: t('subscribe.hour.option', { hour: String(value).padStart(2, '0') }) })),
    [t],
  );
  const measureOptions = useMemo(
    () => measures.map((key) => {
      const declared = (report.spec.dataset.measures ?? []).find((measure) => measure.key === key);
      return { value: key, label: declared?.label ? label(declared.label) : key };
    }),
    [measures, report.spec, label],
  );
  const opOptions = useMemo(
    () => REPORT_ALERT_OPS.map((value) => ({ value, label: t(OP_KEYS[value]) })),
    [t],
  );
  const fileOptions = useMemo(
    () => [
      { value: '', label: t('subscribe.file.none') },
      ...REPORT_FILE_FORMATS.map((format) => ({ value: format, label: t(`subscribe.file.${format}`) })),
    ],
    [t],
  );
  const memberOptions = useMemo(
    () => (references.members ?? []).map((member) => ({ value: member.value, label: member.label })),
    [references],
  );

  const answered = useMemo(
    () => Object.entries(prompts).filter(([, value]) => value !== undefined && value !== null && value !== '').length,
    [prompts],
  );

  const limit = Number(alertValue.replace(',', '.'));
  const alertValid = !alertOn || (alertMeasure !== '' && alertValue.trim() !== '' && Number.isFinite(limit));
  const canSave = recipients.length > 0 && alertValid && !isSaving;

  const save = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await createWorkflow(buildReportSubscription({
        name,
        reportKey: report.key,
        reportTitle,
        prompts,
        frequency,
        hour,
        recipientIds: recipients,
        ...(alertOn ? { alert: { measure: alertMeasure, op: alertOp, value: limit } } : {}),
        ...(file ? { file } : {}),
      }));
      notify(t('subscribe.created'), 'success');
      onClose();
      openTab(`view-workflow:${created.id}`);
    } catch (caught) {
      setError(t('subscribe.failed', { detail: caught instanceof Error ? label(caught.message) : String(caught) }));
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave, createWorkflow, name, report.key, reportTitle, prompts, frequency, hour, recipients,
    alertOn, alertMeasure, alertOp, limit, file, notify, t, onClose, openTab, label,
  ]);

  return {
    title: t('subscribe.title', { title: reportTitle }),
    name,
    setName,
    frequency,
    setFrequency: (value) => { if (isFrequency(value)) setFrequency(value); },
    frequencyOptions,
    hour: String(hour),
    setHour: (value) => setHour(Number(value) || 0),
    hourOptions,
    recipients,
    setRecipients,
    memberOptions,
    canAlert: measures.length > 0,
    alertOn,
    setAlertOn,
    alertMeasure,
    setAlertMeasure,
    measureOptions,
    alertOp,
    setAlertOp: (value) => { if (isOp(value)) setAlertOp(value); },
    opOptions,
    alertValue,
    setAlertValue,
    file,
    setFile: (value) => setFile(isReportFileFormat(value) ? value : ''),
    fileOptions,
    filtersNotice: answered > 0 ? t('subscribe.filters', { count: String(answered) }) : null,
    error: error ?? (recipients.length === 0 ? t('subscribe.recipients.missing') : null),
    canSave,
    isSaving,
    save,
    labels: {
      name: t('subscribe.name'),
      frequency: t('subscribe.frequency'),
      hour: t('subscribe.hour'),
      recipients: t('subscribe.recipients'),
      alert: t('subscribe.alert'),
      measure: t('subscribe.alert.measure'),
      op: t('subscribe.alert.op'),
      value: t('subscribe.alert.value'),
      file: t('subscribe.file'),
      save: t('subscribe.save'),
    },
  };
};
