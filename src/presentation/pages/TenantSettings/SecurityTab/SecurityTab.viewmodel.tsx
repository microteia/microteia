import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useRoles } from '../../../../stores/useRoles';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useNotification } from '../../../../stores/useNotification';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import {
  DEFAULT_MEMBER_MFA_POLICY,
  MFA_REVERIFY_MAX_MINUTES,
  MFA_REVERIFY_MIN_MINUTES,
  isMfaReverifyMinutes,
} from '../../../../domain/schema/memberMfa';
import type { MemberMfaEntry, MemberMfaOverview, MemberMfaPolicy } from '../../../../domain/schema/memberMfa';
import {
  makeGetMemberMfaOverviewUseCase,
  makeResetMemberSecondFactorUseCase,
  makeSaveMemberMfaPolicyUseCase,
} from '../../../../domain/usecases/mfa/SecondFactorUseCases';
import type { MultiSearchSelectOption } from '../../../components/ui/MultiSearchSelect';

export interface SecurityMemberRow {
  userId: string;
  name: string;
  email: string;
  required: boolean;
  enrolled: boolean;
  enrolledAt: string;
  lastVerifiedAt: string;
}

interface PolicyDraft {
  enabled?: boolean;
  everyone?: boolean;
  roleIds?: string[];
  permissions?: string[];
  reverifyMinutes?: string;
}

export interface SecurityTabViewModel {
  loading: boolean;
  saving: boolean;
  loadError: string | null;
  enabled: boolean;
  everyone: boolean;
  roleIds: string[];
  permissions: string[];
  reverifyMinutes: string;
  reverifyMin: string;
  reverifyMax: string;
  reverifyInvalid: boolean;
  scopeEmpty: boolean;
  dirty: boolean;
  canSave: boolean;
  roleOptions: MultiSearchSelectOption[];
  permissionOptions: MultiSearchSelectOption[];
  members: SecurityMemberRow[];
  requiredCount: string;
  missingCount: string;
  pendingResetName: string;
  resetting: boolean;
  setEnabled: (value: boolean) => void;
  setEveryone: (value: boolean) => void;
  setRoleIds: (value: string[]) => void;
  setPermissions: (value: string[]) => void;
  setReverifyMinutes: (value: string) => void;
  save: () => void;
  discard: () => void;
  askReset: (row: SecurityMemberRow) => void;
  cancelReset: () => void;
  confirmReset: () => void;
}

const parseMinutes = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

/**
 * A política de segundo fator do escritório e o estado de cada membro. Tudo passa pela callable
 * `manageMemberMfa`, que valida, recompõe os membros e audita — o documento da política nem é legível
 * pelo cliente.
 *
 * A trava contra trancar a si mesmo é do SERVIDOR (`mfa.policy.verify-first`); a tela só a explica. É
 * por isso que o painel pessoal mora no alto desta aba: quem vai ligar a política para todos prova o
 * próprio fator primeiro, aqui mesmo.
 */
export const useSecurityTabViewModel = (): SecurityTabViewModel => {
  const t = useT('core.access');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();
  const { notify } = useNotification();
  const { currentTenant } = useTenant();
  const { roles } = useRoles();
  const { catalog } = useAuthorization();
  const { memberMfaRepository } = useDI();

  const uc = useMemo(() => ({
    overview: makeGetMemberMfaOverviewUseCase(memberMfaRepository),
    save: makeSaveMemberMfaPolicyUseCase(memberMfaRepository),
    reset: makeResetMemberSecondFactorUseCase(memberMfaRepository),
  }), [memberMfaRepository]);

  const tenantId = currentTenant?.id ?? null;
  const [overview, setOverview] = useState<{ tenantId: string; value: MemberMfaOverview } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PolicyDraft>({});
  const [saving, setSaving] = useState(false);
  const [pendingReset, setPendingReset] = useState<SecurityMemberRow | null>(null);
  const [resetting, setResetting] = useState(false);

  const describe = useCallback(
    (cause: unknown, fallback: string) => label(
      cause instanceof Error && cause.message.startsWith('@') ? cause.message : fallback,
      errorParamsOf(cause),
    ),
    [label],
  );

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.overview.execute(tenantId)
      .then((value) => { if (active) setOverview({ tenantId, value }); })
      .catch((cause: unknown) => { if (active) setLoadError(describe(cause, '@core.access/mfa.failed')); });
    return () => { active = false; };
  }, [tenantId, uc.overview, describe]);

  const current = overview?.tenantId === tenantId ? overview.value : null;
  const policy = current?.policy ?? DEFAULT_MEMBER_MFA_POLICY;

  const enabled = draft.enabled ?? policy.enabled;
  const everyone = draft.everyone ?? policy.everyone;
  const roleIds = draft.roleIds ?? policy.roleIds;
  const permissions = draft.permissions ?? policy.permissions;
  const reverifyMinutes = draft.reverifyMinutes ?? String(policy.reverifyMinutes);
  const parsedMinutes = parseMinutes(reverifyMinutes);
  const reverifyInvalid = !isMfaReverifyMinutes(parsedMinutes);
  const scopeEmpty = enabled && !everyone && roleIds.length === 0 && permissions.length === 0;
  const dirty = Object.keys(draft).length > 0;

  const roleOptions = useMemo<MultiSearchSelectOption[]>(
    () => roles.map((role) => ({ value: role.id, label: role.name })),
    [roles],
  );

  const permissionOptions = useMemo<MultiSearchSelectOption[]>(() => catalog.list.map((permission) => {
    const resource = catalog.resourceLabels.get(permission.resource);
    return {
      value: permission.id,
      label: t('role.qualified-name', {
        action: label(permission.name),
        resource: resource ? label(resource.name, resource.nameParams) : permission.resource,
      }),
      meta: permission.id,
    };
  }), [catalog, label, t]);

  const members = useMemo<SecurityMemberRow[]>(() => (current?.members ?? []).map((entry: MemberMfaEntry) => ({
    userId: entry.userId,
    name: entry.displayName || entry.email || entry.userId,
    email: entry.email,
    required: entry.required,
    enrolled: entry.enrolled,
    enrolledAt: entry.enrolledAt ? formatDateTime(entry.enrolledAt) : '',
    lastVerifiedAt: entry.lastVerifiedAt ? formatDateTime(entry.lastVerifiedAt) : '',
  })), [current, formatDateTime]);

  const save = useCallback(() => {
    if (!tenantId || reverifyInvalid || scopeEmpty || parsedMinutes === null) return;
    const next: MemberMfaPolicy = { enabled, everyone, roleIds, permissions, reverifyMinutes: parsedMinutes };
    setSaving(true);
    uc.save.execute(tenantId, next)
      .then((value) => {
        setOverview({ tenantId, value });
        setDraft({});
        notify(t('mfa.policy.saved'), 'success');
      })
      .catch((cause: unknown) => notify(describe(cause, '@core.access/mfa.failed'), 'error'))
      .finally(() => setSaving(false));
  }, [tenantId, reverifyInvalid, scopeEmpty, parsedMinutes, enabled, everyone, roleIds, permissions, uc.save, notify, t, describe]);

  const confirmReset = useCallback(() => {
    if (!tenantId || !pendingReset) return;
    setResetting(true);
    uc.reset.execute(tenantId, pendingReset.userId)
      .then((value) => {
        setOverview({ tenantId, value });
        notify(t('mfa.reset.done', { member: pendingReset.name }), 'success');
      })
      .catch((cause: unknown) => notify(describe(cause, '@core.access/mfa.failed'), 'error'))
      .finally(() => {
        setResetting(false);
        setPendingReset(null);
      });
  }, [tenantId, pendingReset, uc.reset, notify, t, describe]);

  return {
    loading: current === null && loadError === null,
    saving,
    loadError,
    enabled,
    everyone,
    roleIds,
    permissions,
    reverifyMinutes,
    reverifyMin: String(MFA_REVERIFY_MIN_MINUTES),
    reverifyMax: String(MFA_REVERIFY_MAX_MINUTES),
    reverifyInvalid,
    scopeEmpty,
    dirty,
    canSave: dirty && !saving && !reverifyInvalid && !scopeEmpty,
    roleOptions,
    permissionOptions,
    members,
    requiredCount: String(members.filter((row) => row.required).length),
    missingCount: String(members.filter((row) => row.required && !row.enrolled).length),
    pendingResetName: pendingReset?.name ?? '',
    resetting,
    setEnabled: (value) => setDraft((prev) => ({ ...prev, enabled: value })),
    setEveryone: (value) => setDraft((prev) => ({ ...prev, everyone: value })),
    setRoleIds: (value) => setDraft((prev) => ({ ...prev, roleIds: value })),
    setPermissions: (value) => setDraft((prev) => ({ ...prev, permissions: value })),
    setReverifyMinutes: (value) => setDraft((prev) => ({ ...prev, reverifyMinutes: value })),
    save,
    discard: () => setDraft({}),
    askReset: setPendingReset,
    cancelReset: () => setPendingReset(null),
    confirmReset,
  };
};
