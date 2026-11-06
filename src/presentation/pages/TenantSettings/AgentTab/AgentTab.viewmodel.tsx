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
  makeRemoveAgentGrantUseCase,
  makeRevokeAgentGrantUseCase,
  makeSubscribeToAgentGrantsUseCase,
} from '../../../../domain/usecases/agent';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { AGENT_DEFAULT_EXPIRY_DAYS } from '../../../shared/agentExpiry';


/** Um acesso como a lista o apresenta — o estado já decidido, não os três campos crus. */
export interface AgentGrantRow {
  id: string;
  name: string;
  permissions: string[];
  state: 'active' | 'revoked' | 'expired';
  isOwn: boolean;
  /**
   * O cliente que entrou por OAuth, ou `null` no acesso emitido na tela.
   *
   * A lista mistura os dois caminhos de propósito — revogar é o mesmo gesto para os dois —, e é
   * esta linha que diz qual é qual a quem precisa decidir se reconhece o acesso.
   */
  signedInFrom: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  canRevoke: boolean;
  canRemove: boolean;
}

/** `acs_fornecedores.read` e `acs_fornecedores.update` viram uma linha só, com as duas ações. */
export interface AgentPermissionGroup {
  resource: string;
  actions: string[];
}

const groupPermissions = (permissions: readonly string[]): AgentPermissionGroup[] => {
  const groups = new Map<string, string[]>();
  for (const permission of [...permissions].sort()) {
    const cut = permission.lastIndexOf('.');
    const resource = cut > 0 ? permission.slice(0, cut) : permission;
    const action = cut > 0 ? permission.slice(cut + 1) : '';
    groups.set(resource, [...(groups.get(resource) ?? []), ...(action === '' ? [] : [action])]);
  }
  return [...groups].map(([resource, actions]) => ({ resource, actions }));
};

export interface AgentTabViewModel {
  availability: AgentAvailability;
  endpointUrl: string;
  /** A linha pronta para colar num terminal, com o token do acesso recém-emitido. */
  connectCommand: string;

  /**
   * Os ativos em cima e os inativos à parte: o revogado e o vencido não autenticam mais, e
   * misturá-los obrigava a ler a lista inteira para achar o que ainda está no ar.
   */
  activeRows: AgentGrantRow[];
  inactiveRows: AgentGrantRow[];
  isEmpty: boolean;
  isLoading: boolean;

  /** O teto de um acesso é consulta rara, e por isso abre em modal em vez de ocupar a linha. */
  viewingPermissions: AgentGrantRow | null;
  viewingPermissionGroups: AgentPermissionGroup[];
  openPermissions: (row: AgentGrantRow) => void;
  closePermissions: () => void;

  isFormOpen: boolean;
  openForm: () => void;
  closeForm: () => void;
  name: string;
  setName: (value: string) => void;
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

  removing: AgentGrantRow | null;
  askRemove: (row: AgentGrantRow) => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;
  isRemoving: boolean;
}

export const useAgentTabViewModel = (): AgentTabViewModel => {
  const { agentGrantRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { installed } = useInstalledExtensions();
  const { can } = useAuthorization();
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
  const [expiryDays, setExpiryDays] = useState<number | null>(AGENT_DEFAULT_EXPIRY_DAYS);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AgentGrantRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [viewingPermissions, setViewingPermissions] = useState<AgentGrantRow | null>(null);
  const [removing, setRemoving] = useState<AgentGrantRow | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const subscribeUC = useMemo(
    () => makeSubscribeToAgentGrantsUseCase(agentGrantRepository),
    [agentGrantRepository],
  );
  const issueUC = useMemo(() => makeIssueAgentGrantUseCase(agentGrantRepository), [agentGrantRepository]);
  const revokeUC = useMemo(() => makeRevokeAgentGrantUseCase(agentGrantRepository), [agentGrantRepository]);
  const removeUC = useMemo(() => makeRemoveAgentGrantUseCase(agentGrantRepository), [agentGrantRepository]);

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

  const canManageOthers = can(PERMISSION_AGENT_MANAGE);

  const rows = useMemo<AgentGrantRow[]>(
    () => grants.map((grant) => {
      // O estado é DECIDIDO aqui, com a mesma função que o gateway usa — mas sobre o CONSENTIMENTO
      // (`revokedAt`/`expiresAt`), sem o `accessExpiresAt`. O token curto do OAuth vence toda hora e
      // o refresh o renova; contá-lo aqui mostrava como "expirado", e sem o botão de revogar, um
      // acesso que continuava no ar. É também o critério da regra que deixa apagar.
      const state = grantRefusal(
        { revokedAt: grant.revokedAt, expiresAt: grant.expiresAt },
        new Date(),
      ) ?? 'active';
      const isOwn = grant.userId === user?.id;
      const mayAct = isOwn || canManageOthers;
      return {
        id: grant.id,
        name: grant.name,
        permissions: grant.permissions,
        state,
        isOwn,
        signedInFrom: grant.origin === 'oauth' ? grant.name : null,
        expiresAt: grant.expiresAt,
        lastUsedAt: grant.lastUsedAt,
        createdAt: grant.createdAt,
        canRevoke: state === 'active' && mayAct,
        canRemove: state !== 'active' && mayAct,
      };
    }),
    [grants, user?.id, canManageOthers],
  );
  const activeRows = useMemo(() => rows.filter((row) => row.state === 'active'), [rows]);
  const inactiveRows = useMemo(() => rows.filter((row) => row.state !== 'active'), [rows]);

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
    setExpiryDays(AGENT_DEFAULT_EXPIRY_DAYS);
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

  const viewingPermissionGroups = useMemo(
    () => (viewingPermissions === null ? [] : groupPermissions(viewingPermissions.permissions)),
    [viewingPermissions],
  );

  const confirmRemove = useCallback(async () => {
    if (tenantId === null || removing === null) return;
    setIsRemoving(true);
    try {
      await removeUC.execute(tenantId, removing.id);
      setRemoving(null);
    } catch {
      // Direto do Firestore, não de callable nossa: a `message` do erro não é referência do
      // catálogo, e passá-la por `report` mostraria o texto cru do SDK.
      notify(t('agent.remove.failed'), 'error');
    } finally {
      setIsRemoving(false);
    }
  }, [tenantId, removing, removeUC, notify, t]);

  return {
    availability,
    endpointUrl,
    connectCommand,
    activeRows,
    inactiveRows,
    isEmpty: rows.length === 0,
    isLoading,
    viewingPermissions,
    viewingPermissionGroups,
    openPermissions: useCallback((row: AgentGrantRow) => setViewingPermissions(row), []),
    closePermissions: useCallback(() => setViewingPermissions(null), []),
    isFormOpen,
    openForm,
    closeForm,
    name,
    setName,
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
    removing,
    askRemove: useCallback((row: AgentGrantRow) => setRemoving(row), []),
    cancelRemove: useCallback(() => setRemoving(null), []),
    confirmRemove,
    isRemoving,
  };
};
