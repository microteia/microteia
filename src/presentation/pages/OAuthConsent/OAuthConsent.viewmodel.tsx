import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { useNotification } from '../../../stores/useNotification';
import type { AgentAvailability } from '../../../domain/usecases/agent/agentAvailability';
import { agentAvailability } from '../../../domain/usecases/agent/agentAvailability';
import type { AgentAuthRequestView } from '../../../domain/repositories/IAgentAuthRequestRepository';
import {
  makeConsentAgentAuthRequestUseCase,
  makeGetAgentAuthRequestUseCase,
} from '../../../domain/usecases/agent';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../shared/i18n/useT';
import { AGENT_DEFAULT_EXPIRY_DAYS } from '../../shared/agentExpiry';

export interface TenantChoice {
  value: string;
  label: string;
}

export interface OAuthConsentViewModel {
  availability: AgentAvailability;
  /** `null` enquanto carrega; a recusa vem por `error`. */
  request: AgentAuthRequestView | null;
  error: string | null;

  /** Quem está autorizando. O consentimento abre noutra origem, e a sessão dela pode ser outra conta. */
  accountEmail: string;
  switchAccount: () => Promise<void>;

  tenantId: string;
  tenantName: string;
  /** Vazia quando há um escritório só: aí não há o que escolher, e o nome basta. */
  tenantChoices: TenantChoice[];
  chooseTenant: (tenantId: string) => Promise<void>;
  isSwitchingTenant: boolean;
  /** As permissões marcadas foram descartadas porque o escritório mudou por OUTRA aba. */
  tenantChangedElsewhere: boolean;

  selectedPermissions: string[];
  setSelectedPermissions: (ids: string[]) => void;
  expiryDays: number | null;
  setExpiryDays: (days: number | null) => void;

  canAllow: boolean;
  isWorking: boolean;
  allow: () => Promise<void>;
  deny: () => void;
  denied: boolean;
}

/**
 * A tela que pergunta à pessoa se um cliente de IA pode trabalhar no escritório em nome dela.
 *
 * Ela mostra a CONTA e deixa escolher o ESCRITÓRIO porque não pode presumir nenhum dos dois (#18): o
 * emissor é sempre a origem `web.app`, e quem trabalha em `firebaseapp.com` ou num domínio próprio
 * chega aqui com outra sessão — outro "último escritório", às vezes outra conta. Sem escolha na tela,
 * o acesso caía no escritório de que a conta é dona, e a pessoa só descobria pelo cliente de IA.
 *
 * Escolher passa pelo `selectTenant` de sempre, e não por um estado local: é ele que troca o catálogo
 * e as permissões que o seletor oferece — o que esta pessoa tem NAQUELE escritório.
 */
export const useOAuthConsentViewModel = (): OAuthConsentViewModel => {
  const [params] = useSearchParams();
  const { agentAuthRequestRepository } = useDI();
  const { currentTenant, availableTenants, selectTenant } = useTenant();
  const { user, signOut } = useAuth();
  const { installed, appliedBackend } = useInstalledExtensions();
  const { notify } = useNotification();
  const label = useLabel();
  const t = useT('core.access');

  const requestId = params.get('request') ?? '';

  /**
   * O desfecho da busca JUNTO do pedido a que ele pertence — um estado só, não dois.
   *
   * É o que permite `error` e `request` serem DERIVADOS em vez de escritos: trocar de pedido
   * invalida os dois de uma vez, e nada precisa ser zerado dentro de um efeito — que é justamente o
   * que `react-hooks/set-state-in-effect` recusa, e com razão: por um instante a tela mostraria o
   * cliente do pedido anterior.
   */
  const [outcome, setOutcome] = useState<
    { requestId: string; request: AgentAuthRequestView; error?: undefined }
    | { requestId: string; request?: undefined; error: string }
    | null
  >(null);
  /**
   * As permissões marcadas JUNTO do escritório em que foram marcadas.
   *
   * O escritório corrente acompanha as outras abas pelo `storage`, e uma troca feita lá chegava aqui
   * com as marcações intactas — o Autorizar mandava o id de um escritório com a escolha feita no
   * outro. Amarradas ao escritório, elas simplesmente deixam de valer quando ele muda, sem efeito
   * nenhum para zerá-las.
   */
  const [selection, setSelection] = useState<{ tenantId: string | null; ids: string[] }>({
    tenantId: null,
    ids: [],
  });
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(AGENT_DEFAULT_EXPIRY_DAYS);
  const [isWorking, setIsWorking] = useState(false);
  const [denied, setDenied] = useState(false);

  const getUC = useMemo(
    () => makeGetAgentAuthRequestUseCase(agentAuthRequestRepository),
    [agentAuthRequestRepository],
  );
  const consentUC = useMemo(
    () => makeConsentAgentAuthRequestUseCase(agentAuthRequestRepository),
    [agentAuthRequestRepository],
  );

  useEffect(() => {
    if (requestId === '') return;

    let current = true;
    void getUC.execute(requestId)
      .then((request) => {
        if (current) setOutcome({ requestId, request });
      })
      .catch((failure: unknown) => {
        if (!current) return;
        // A `message` de um `HttpsError` JÁ É a referência que a callable emitiu, e `label` a
        // resolve. O backend nunca formata frase — mesmo molde do `AgentTab`.
        setOutcome({
          requestId,
          error: label(
            failure instanceof Error ? failure.message : t('agent.oauth.request.unknown'),
            errorParamsOf(failure),
          ),
        });
      });
    return () => { current = false; };
  }, [requestId, getUC, label, t]);

  const settled = outcome?.requestId === requestId ? outcome : null;
  const request = settled?.request ?? null;
  // A ausência do parâmetro não precisa de busca nenhuma para ser sabida, e por isso não é estado.
  const error = requestId === '' ? t('agent.oauth.request.missing') : settled?.error ?? null;
  const availability = useMemo(() => agentAvailability(installed, appliedBackend), [installed, appliedBackend]);

  const tenantId = currentTenant?.id ?? '';
  const selectedPermissions = useMemo(
    () => (selection.tenantId === tenantId ? selection.ids : []),
    [selection, tenantId],
  );
  const setSelectedPermissions = useCallback(
    (ids: string[]) => setSelection({ tenantId, ids }),
    [tenantId],
  );
  const tenantChangedElsewhere = selection.tenantId !== null
    && selection.tenantId !== tenantId
    && selection.ids.length > 0;

  const tenantChoices = useMemo<TenantChoice[]>(
    () => (availableTenants.length > 1
      ? availableTenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))
      : []),
    [availableTenants],
  );

  const chooseTenant = useCallback(async (nextId: string) => {
    if (nextId === '' || nextId === tenantId) return;
    // Trocada AQUI, a escolha anterior é descartada sem aviso: a pessoa acabou de pedir a troca.
    setSelection({ tenantId: null, ids: [] });
    setIsSwitchingTenant(true);
    try {
      await selectTenant(nextId);
    } catch (failure: unknown) {
      notify(
        label(
          failure instanceof Error ? failure.message : '@core.workspace/tenant.load-failed',
          errorParamsOf(failure),
        ),
        'error',
      );
    } finally {
      setIsSwitchingTenant(false);
    }
  }, [tenantId, selectTenant, notify, label]);

  // Sair devolve ao login, e o `ProtectedRoute` guarda este endereço: a pessoa volta ao MESMO pedido,
  // que segue válido pelo prazo dele.
  const switchAccount = useCallback(() => signOut(), [signOut]);

  const allow = useCallback(async () => {
    if (request === null || currentTenant === null) return;
    setIsWorking(true);
    try {
      const redirectTo = await consentUC.execute({
        requestId,
        tenantId: currentTenant.id,
        permissions: selectedPermissions,
        expiresInDays: expiryDays,
      });
      // Sai do app por completo: o destino é do cliente, não uma rota nossa, e `assign` é o que
      // entrega o código a ele. Voltar pelo histórico cairia num pedido já consumido.
      window.location.assign(redirectTo);
    } catch (failure: unknown) {
      setIsWorking(false);
      notify(
        label(
          failure instanceof Error ? failure.message : t('agent.token.failed'),
          errorParamsOf(failure),
        ),
        'error',
      );
    }
  }, [request, currentTenant, consentUC, requestId, selectedPermissions, expiryDays, notify, label, t]);

  // Negar não avisa o cliente, e é de propósito: o pedido expira sozinho, e redirecionar com
  // `access_denied` exigiria confiar no destino antes de a pessoa ter autorizado qualquer coisa.
  const deny = useCallback(() => setDenied(true), []);

  return {
    availability,
    request,
    error,
    accountEmail: user?.email ?? '',
    switchAccount,
    tenantId,
    tenantName: currentTenant?.name ?? '',
    tenantChoices,
    chooseTenant,
    isSwitchingTenant,
    tenantChangedElsewhere,
    selectedPermissions,
    setSelectedPermissions,
    expiryDays,
    setExpiryDays,
    canAllow: request !== null
      && currentTenant !== null
      && !isSwitchingTenant
      && selectedPermissions.length > 0
      && availability === 'ready',
    isWorking,
    allow,
    deny,
    denied,
  };
};
