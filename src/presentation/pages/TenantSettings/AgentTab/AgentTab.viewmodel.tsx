import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useInstalledExtensions } from '../../../../stores/useInstalledExtensions';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { httpFunctionUrl } from '../../../../infrastructure/firebase/config';
import { AGENT_MCP_FUNCTION } from '../../../../domain/schema/agent/agentBackend';
import { PERMISSION_AGENT_MANAGE } from '../../../../domain/schema/access';
import type { AgentGrant } from '../../../../domain/schema/agent/agentGrant';
import { grantRefusal } from '../../../../domain/schema/agent/agentGrant';
import type { AgentAvailability } from '../../../../domain/usecases/agent/agentAvailability';
import { agentAvailability } from '../../../../domain/usecases/agent/agentAvailability';
import {
  makeIssueAgentGrantUseCase,
  makeRevokeAgentGrantUseCase,
  makeSubscribeToAgentGrantsUseCase,
} from '../../../../domain/usecases/agent';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../../shared/i18n/useT';

/** As validades oferecidas. Chave de catálogo no rótulo, dias no valor. */
export const AGENT_EXPIRY_CHOICES: { days: number | null; labelKey: string }[] = [
  { days: 30, labelKey: 'agent.expiry.30' },
  { days: 90, labelKey: 'agent.expiry.90' },
  { days: 365, labelKey: 'agent.expiry.365' },
  { days: null, labelKey: 'agent.expiry.never' },
];

const DEFAULT_EXPIRY_DAYS = 90;

/** Uma permissão oferecível: o id, o rótulo já resolvido, e o recurso a que ela pertence. */
export interface AgentPermissionChoice {
  id: string;
  label: string;
  resource: string;
}

/** Um acesso como a lista o apresenta — o estado já decidido, não os três campos crus. */
export interface AgentGrantRow {
  id: string;
  name: string;
  permissions: string[];
  state: 'active' | 'revoked' | 'expired';
  isOwn: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface AgentTabViewModel {
  availability: AgentAvailability;
  endpointUrl: string;
  /** A linha pronta para colar num terminal, com o token do acesso recém-emitido. */
  connectCommand: string;

  rows: AgentGrantRow[];
  isLoading: boolean;
  canManageOthers: boolean;

  isFormOpen: boolean;
  openForm: () => void;
  closeForm: () => void;
  name: string;
  setName: (value: string) => void;
  permissionChoices: AgentPermissionChoice[];
  selectedPermissions: string[];
  setSelectedPermissions: (values: string[]) => void;
  expiryDays: number | null;
  setExpiryDays: (days: number | null) => void;
  canSubmit: boolean;
  isIssuing: boolean;
  submit: () => Promise<void>;

  /** O token em claro, mostrado UMA vez. `null` fora desse instante. */
  issuedToken: string | null;
  dismissIssuedToken: () => void;
  copyIssuedToken: () => Promise<void>;

  revoking: AgentGrantRow | null;
  askRevoke: (row: AgentGrantRow) => void;
  cancelRevoke: () => void;
  confirmRevoke: () => Promise<void>;
  isRevoking: boolean;
}

export const useAgentTabViewModel = (): AgentTabViewModel => {
  const { agentGrantRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { installed } = useInstalledExtensions();
  const { can, catalog, effectivePermissions, isUnrestricted } = useAuthorization();
  const { notify } = useNotification();
  const label = useLabel();
  const t = useT('core.access');

  /**
   * Os acessos JUNTO do escritório de que eles são — um estado só, não dois.
   *
   * É o que permite `isLoading` ser DERIVADO em vez de escrito: enquanto o escritório carregado não
   * é o corrente, está carregando. Guardar um booleano à parte obrigaria a escrevê-lo dentro do
   * efeito de assinatura, que é justamente o que `react-hooks/set-state-in-effect` recusa — e com
   * razão, porque trocar de escritório mostraria por um instante os acessos do anterior.
   */
  const [loaded, setLoaded] = useState<{ tenantId: string; grants: AgentGrant[] } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState<number | null>(DEFAULT_EXPIRY_DAYS);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AgentGrantRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const subscribeUC = useMemo(
    () => makeSubscribeToAgentGrantsUseCase(agentGrantRepository),
    [agentGrantRepository],
  );
  const issueUC = useMemo(() => makeIssueAgentGrantUseCase(agentGrantRepository), [agentGrantRepository]);
  const revokeUC = useMemo(() => makeRevokeAgentGrantUseCase(agentGrantRepository), [agentGrantRepository]);

  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    if (tenantId === null) return;
    return subscribeUC.execute(
      tenantId,
      (grants) => setLoaded({ tenantId, grants }),
      // A falha de leitura também RESOLVE o carregamento: sem isto a tela giraria para sempre em
      // quem não pode ler os acessos de outros, em vez de mostrar apenas os seus.
      () => setLoaded({ tenantId, grants: [] }),
    );
  }, [tenantId, subscribeUC]);

  // Em `useMemo` porque a lista alimenta outro `useMemo`: um array literal novo a cada render faria
  // as linhas serem recalculadas sempre, e o ESLint recusa a dependência instável.
  const grants = useMemo(
    () => (loaded?.tenantId === tenantId ? loaded.grants : []),
    [loaded, tenantId],
  );
  const isLoading = tenantId !== null && loaded?.tenantId !== tenantId;

  const availability = useMemo(() => agentAvailability(installed), [installed]);
  const endpointUrl = useMemo(() => httpFunctionUrl(AGENT_MCP_FUNCTION), []);
  const connectCommand = useMemo(
    () => `claude mcp add --transport http microteia ${endpointUrl} --header "Authorization: Bearer ${issuedToken ?? ''}"`,
    [endpointUrl, issuedToken],
  );

  const rows = useMemo<AgentGrantRow[]>(
    () => grants.map((grant) => ({
      id: grant.id,
      name: grant.name,
      permissions: grant.permissions,
      // O estado é DECIDIDO aqui, com a mesma função que o gateway usa: a lista e a recusa do
      // servidor não podem discordar sobre o que é um acesso expirado.
      state: grantRefusal(grant, new Date()) ?? 'active',
      isOwn: grant.userId === user?.id,
      expiresAt: grant.expiresAt,
      lastUsedAt: grant.lastUsedAt,
      createdAt: grant.createdAt,
    })),
    [grants, user?.id],
  );

  /**
   * O que este membro pode OFERECER a um agente: nunca mais do que ele próprio tem.
   *
   * A mesma conta que a callable refaz do lado do servidor — aqui ela existe para a tela não oferecer
   * o que seria recusado, e não como garantia. A garantia é a de lá.
   */
  const permissionChoices = useMemo<AgentPermissionChoice[]>(() => {
    const held = new Set(effectivePermissions);
    return catalog.list
      .filter((permission) => isUnrestricted || held.has(permission.id))
      .map((permission) => ({
        id: permission.id,
        label: label(permission.name),
        resource: label(catalog.resourceLabels.get(permission.resource)?.name ?? permission.resource),
      }));
  }, [catalog, effectivePermissions, isUnrestricted, label]);

  /**
   * A recusa do servidor, dita a quem clicou.
   *
   * A `message` de um `HttpsError` JÁ É a referência que a callable emitiu
   * (`@core.access/agent.permission.unknown`), e `label` a resolve com os `errorParams` que ela
   * interpola. O `fallback` só entra quando o que chegou não é um erro nosso. Mesmo molde do
   * `RolesTab`, e pelo mesmo motivo: o backend nunca formata frase.
   */
  const report = useCallback(
    (error: unknown, fallback: string) =>
      notify(label(error instanceof Error ? error.message : t(fallback), errorParamsOf(error)), 'error'),
    [notify, label, t],
  );

  const openForm = useCallback(() => {
    setName('');
    setSelectedPermissions([]);
    setExpiryDays(DEFAULT_EXPIRY_DAYS);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => setIsFormOpen(false), []);

  const submit = useCallback(async () => {
    if (tenantId === null) return;
    setIsIssuing(true);
    try {
      const issued = await issueUC.execute(tenantId, {
        name: name.trim(),
        permissions: selectedPermissions,
        expiresInDays: expiryDays,
      });
      setIsFormOpen(false);
      // O token entra no estado e é mostrado UMA vez. Ele não volta para a lista nem para o
      // Firestore: o servidor guardou só o hash.
      setIssuedToken(issued.token);
    } catch (error) {
      report(error, 'agent.token.failed');
    } finally {
      setIsIssuing(false);
    }
  }, [tenantId, issueUC, name, selectedPermissions, expiryDays, report]);

  const copyIssuedToken = useCallback(async () => {
    if (issuedToken === null) return;
    await navigator.clipboard.writeText(issuedToken);
    notify(t('agent.token.copied'), 'success');
  }, [issuedToken, notify, t]);

  const confirmRevoke = useCallback(async () => {
    if (tenantId === null || revoking === null) return;
    setIsRevoking(true);
    try {
      await revokeUC.execute(tenantId, revoking.id);
      setRevoking(null);
    } catch (error) {
      report(error, 'agent.revoke.failed');
    } finally {
      setIsRevoking(false);
    }
  }, [tenantId, revoking, revokeUC, report]);

  return {
    availability,
    endpointUrl,
    connectCommand,
    rows,
    isLoading,
    canManageOthers: can(PERMISSION_AGENT_MANAGE),
    isFormOpen,
    openForm,
    closeForm,
    name,
    setName,
    permissionChoices,
    selectedPermissions,
    setSelectedPermissions,
    expiryDays,
    setExpiryDays,
    canSubmit: name.trim() !== '' && selectedPermissions.length > 0 && !isIssuing,
    isIssuing,
    submit,
    issuedToken,
    dismissIssuedToken: useCallback(() => setIssuedToken(null), []),
    copyIssuedToken,
    revoking,
    askRevoke: useCallback((row: AgentGrantRow) => setRevoking(row), []),
    cancelRevoke: useCallback(() => setRevoking(null), []),
    confirmRevoke,
    isRevoking,
  };
};
