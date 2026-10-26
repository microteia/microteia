import { useCallback, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { PERMISSION_AUDIT_MANAGE } from '../../../../domain/schema/access';
import {
  AUDIT_ARCHIVE_MAX_YEARS,
  AUDIT_CHAIN_DIVERGENCE_MESSAGES,
  AUDIT_RETENTION_MAX_DAYS,
  DEFAULT_AUDIT_RETENTION_DAYS,
  isAuditArchiveYears,
  isAuditDay,
  isAuditRetentionDays,
} from '../../../../domain/schema/auditRetention';
import type {
  AuditArchiveDayPage,
  AuditChainVerification,
  AuditRetentionPolicy,
  AuditRetentionStatus,
} from '../../../../domain/schema/auditRetention';
import {
  makeReadAuditArchiveDayUseCase,
  makeSaveAuditRetentionPolicyUseCase,
  makeVerifyAuditArchiveUseCase,
} from '../../../../domain/usecases/auditlogs/AuditArchiveUseCases';
import { archivedAuditLog, presentAuditLog } from '../auditLogLabels';
import type { AuditLog } from '../../../../domain/entities';
import type { AuditLogRow } from '../AuditLogs.viewmodel';
import { useLabel, useT } from '../../../shared/i18n/useT';

const DAY_PAGE = 50;

export interface AuditRetentionPanelProps {
  status: AuditRetentionStatus;
  onStatusChange: (status: AuditRetentionStatus) => void;
  onOpenEntity: (log: AuditLog) => void;
}

interface Draft {
  days?: string;
  archive?: boolean;
  years?: string;
}

export type ProtectionNotice = 'bucket' | 'object' | 'none' | 'unknown' | null;

export interface AuditRetentionPanelViewModel {
  canManage: boolean;
  archiveAvailable: boolean;
  minDays: number;
  maxDays: number;
  maxYears: number;
  days: string;
  archive: boolean;
  years: string;
  daysInvalid: boolean;
  yearsInvalid: boolean;
  turningOff: boolean;
  dirty: boolean;
  saving: boolean;
  setDays: (value: string) => void;
  setArchive: (value: boolean) => void;
  setYears: (value: string) => void;
  save: () => void;

  showArchiveStatus: boolean;
  protection: ProtectionNotice;
  protectionMessage: string;
  startDay: string | null;
  lastDay: string | null;
  headHash: string | null;
  failureMessage: string | null;

  verifying: boolean;
  verifyProgress: number;
  verification: AuditChainVerification | null;
  verificationMessage: string | null;
  verificationDetails: string[];
  verify: () => void;

  browseDay: string;
  setBrowseDay: (value: string) => void;
  openDay: () => void;
  dayLoading: boolean;
  dayPage: AuditArchiveDayPage | null;
  daySummary: string | null;
  dayRows: AuditLogRow[];
  hasMoreLines: boolean;
  loadMoreLines: () => void;
  toggleLine: (id: string) => void;
  openEntity: (log: AuditLog) => void;
}

const parseInteger = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

export const useAuditRetentionPanelViewModel = ({ status, onStatusChange, onOpenEntity }: AuditRetentionPanelProps): AuditRetentionPanelViewModel => {
  const t = useT('core.admin');
  const label = useLabel();
  const { auditArchiveRepository } = useDI();
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { userRole } = useAuth();
  const { notify } = useNotification();
  const { dynamicScreens } = useScreenDefinitions();
  const tenantId = currentTenant?.id ?? null;
  const canManage = userRole === 'SYSTEM' || can(PERMISSION_AUDIT_MANAGE);

  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verification, setVerification] = useState<AuditChainVerification | null>(null);
  const [browseDay, setBrowseDay] = useState('');
  const [dayLoading, setDayLoading] = useState(false);
  const [dayPage, setDayPage] = useState<AuditArchiveDayPage | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  const { policy, state, protection: bucket } = status;
  const days = draft.days ?? String(policy.retentionDays);
  const archive = draft.archive ?? policy.archive.enabled;
  const years = draft.years ?? String(policy.archive.retentionYears);
  const parsedDays = parseInteger(days);
  const parsedYears = parseInteger(years);
  const daysInvalid = !isAuditRetentionDays(parsedDays);
  const yearsInvalid = !isAuditArchiveYears(parsedYears);
  const dirty = parsedDays !== policy.retentionDays
    || archive !== policy.archive.enabled
    || parsedYears !== policy.archive.retentionYears;

  const describeError = useCallback(
    (error: unknown, fallback: string) => label(error instanceof Error && error.message.startsWith('@') ? error.message : fallback),
    [label],
  );

  const save = useCallback(() => {
    if (!tenantId || daysInvalid || yearsInvalid || parsedDays === null || parsedYears === null) return;
    const next: AuditRetentionPolicy = { retentionDays: parsedDays, archive: { enabled: archive, retentionYears: parsedYears } };
    setSaving(true);
    makeSaveAuditRetentionPolicyUseCase(auditArchiveRepository).execute(tenantId, next)
      .then((saved) => {
        setDraft({});
        onStatusChange(saved);
        notify(t('audit.retention.saved'), 'success');
      })
      .catch((error: unknown) => notify(describeError(error, '@core.admin/audit.archive.failed'), 'error'))
      .finally(() => setSaving(false));
  }, [tenantId, daysInvalid, yearsInvalid, parsedDays, parsedYears, archive, auditArchiveRepository, onStatusChange, notify, t, describeError]);

  const protection = useMemo<ProtectionNotice>(() => {
    if (!status.archiveAvailable) return null;
    if (!bucket) return 'unknown';
    if (bucket.bucketRetentionLocked) return 'bucket';
    if (bucket.objectRetentionLock) return 'object';
    return 'none';
  }, [status.archiveAvailable, bucket]);

  const protectionMessage = useMemo(() => {
    if (protection === 'bucket') return t('audit.archive.protection.bucket', { days: String(bucket?.bucketRetentionDays ?? '') });
    if (protection === 'object') return t('audit.archive.protection.object');
    if (protection === 'none') return t('audit.archive.protection.none');
    if (protection === 'unknown') return t('audit.archive.protection.unknown');
    return '';
  }, [protection, bucket, t]);

  const failureMessage = state.failure
    ? t('audit.archive.failing', {
      day: state.failure.day,
      attempts: String(state.failure.attempts),
      since: new Date(state.failure.firstFailedAt).toLocaleString(),
      error: label(state.failure.message),
    })
    : null;

  const verify = useCallback(() => {
    if (!tenantId) return;
    setVerifying(true);
    setVerification(null);
    setVerifyProgress(0);
    makeVerifyAuditArchiveUseCase(auditArchiveRepository)
      .execute(tenantId, (partial) => setVerifyProgress(partial.daysChecked))
      .then(setVerification)
      .catch((error: unknown) => notify(describeError(error, '@core.admin/audit.archive.failed'), 'error'))
      .finally(() => setVerifying(false));
  }, [tenantId, auditArchiveRepository, notify, describeError]);

  const verificationMessage = useMemo(() => {
    if (!verification) return null;
    if (verification.divergence) {
      const { day, line, logId, reason } = verification.divergence;
      return label(AUDIT_CHAIN_DIVERGENCE_MESSAGES[reason], { day, line: String(line ?? ''), logId: logId ?? '' });
    }
    const counts = { count: String(verification.daysChecked), first: verification.firstDay ?? '', last: verification.lastDay ?? '' };
    if (verification.status === 'empty') return t('audit.archive.verify.empty');
    if (verification.status === 'partial') return t('audit.archive.verify.partial', counts);
    return t('audit.archive.verify.intact', counts);
  }, [verification, label, t]);

  const verificationDetails = useMemo(() => {
    if (!verification) return [];
    const details: string[] = [];
    if (verification.gaps.length > 0) {
      details.push(t('audit.archive.verify.gaps', {
        list: verification.gaps.map((gap) => `${gap.after} → ${gap.resumedAt}`).join(', '),
      }));
    }
    if (verification.incompleteDays.length > 0) {
      details.push(t('audit.archive.verify.incomplete', { list: verification.incompleteDays.join(', ') }));
    }
    return details;
  }, [verification, t]);

  const loadDay = useCallback((day: string, offset: number) => {
    if (!tenantId || !isAuditDay(day)) return;
    setDayLoading(true);
    makeReadAuditArchiveDayUseCase(auditArchiveRepository).execute(tenantId, day, offset, DAY_PAGE)
      .then((page) => setDayPage((previous) => (
        offset > 0 && previous?.day === page.day ? { ...page, lines: [...previous.lines, ...page.lines] } : page
      )))
      .catch((error: unknown) => notify(describeError(error, '@core.admin/audit.archive.failed'), 'error'))
      .finally(() => setDayLoading(false));
  }, [tenantId, auditArchiveRepository, notify, describeError]);

  const openDay = useCallback(() => {
    setExpandedLines(new Set());
    loadDay(browseDay, 0);
  }, [browseDay, loadDay]);

  const loadMoreLines = useCallback(() => {
    if (dayPage) loadDay(dayPage.day, dayPage.lines.length);
  }, [dayPage, loadDay]);

  const toggleLine = useCallback((id: string) => {
    setExpandedLines((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const dayRows = useMemo<AuditLogRow[]>(() => (dayPage?.lines ?? []).map((line) => {
    const presented = presentAuditLog(t, label, archivedAuditLog(line.log), dynamicScreens);
    return {
      log: presented.log,
      entityLabel: presented.entityLabel,
      tenantName: null,
      expanded: expandedLines.has(presented.log.id),
      hash: line.hash,
    };
  }), [dayPage, expandedLines, dynamicScreens, label, t]);

  const daySummary = dayPage?.header
    ? t('audit.archive.browse.summary', {
      count: String(dayPage.header.count),
      hash: dayPage.header.dayHash,
      previous: dayPage.header.previousDayHash,
    })
    : null;

  return {
    canManage,
    archiveAvailable: status.archiveAvailable,
    minDays: DEFAULT_AUDIT_RETENTION_DAYS,
    maxDays: AUDIT_RETENTION_MAX_DAYS,
    maxYears: AUDIT_ARCHIVE_MAX_YEARS,
    days,
    archive,
    years,
    daysInvalid,
    yearsInvalid,
    turningOff: policy.archive.enabled && !archive,
    dirty,
    saving,
    setDays: (value) => setDraft((previous) => ({ ...previous, days: value })),
    setArchive: (value) => setDraft((previous) => ({ ...previous, archive: value })),
    setYears: (value) => setDraft((previous) => ({ ...previous, years: value })),
    save,

    showArchiveStatus: policy.archive.enabled || state.lastDay !== null,
    protection,
    protectionMessage,
    startDay: state.startDay,
    lastDay: state.lastDay,
    headHash: state.headHash,
    failureMessage,

    verifying,
    verifyProgress,
    verification,
    verificationMessage,
    verificationDetails,
    verify,

    browseDay,
    setBrowseDay,
    openDay,
    dayLoading,
    dayPage,
    daySummary,
    dayRows,
    hasMoreLines: !!dayPage && dayPage.lines.length < dayPage.total,
    loadMoreLines,
    toggleLine,
    openEntity: onOpenEntity,
  };
};
