import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
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
import type { AgentPermissionChoice } from '../../shared/agentExpiry';
import { AGENT_DEFAULT_EXPIRY_DAYS } from '../../shared/agentExpiry';

export interface OAuthConsentViewModel {
  availability: AgentAvailability;
  /** `null` enquanto carrega; a recusa vem por `error`. */
  request: AgentAuthRequestView | null;
  error: string | null;
  tenantName: string;

  permissionChoices: AgentPermissionChoice[];
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
 * Ela consente para o escritório CORRENTE, e não oferece um seletor próprio: o app já tem um, e
 * duplicá-lo aqui criaria uma segunda forma de escolher escritório — que divergiria da primeira no
 * dia em que uma das duas ganhasse uma regra. Quem quis outro escritório troca no seletor de sempre
 * e volta; o pedido continua válido pelo prazo dele.
 */
export const useOAuthConsentViewModel = (): OAuthConsentViewModel => {
  const [params] = useSearchParams();
  const { agentAuthRequestRepository } = useDI();
  const { currentTenant } = useTenant();
  const { catalog, effectivePermissions, isUnrestricted } = useAuthorization();
  const { installed } = useInstalledExtensions();
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
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
  const availability = useMemo(() => agentAvailability(installed), [installed]);

  /**
   * O que esta pessoa pode OFERECER: nunca mais do que ela própria tem.
   *
   * A mesma conta que `issueAgentGrant` refaz no servidor. Aqui ela existe para a tela não oferecer
   * o que seria recusado, e não como garantia — a garantia é a de lá.
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
    tenantName: currentTenant?.name ?? '',
    permissionChoices,
    selectedPermissions,
    setSelectedPermissions,
    expiryDays,
    setExpiryDays,
    canAllow: request !== null
      && currentTenant !== null
      && selectedPermissions.length > 0
      && availability === 'ready',
    isWorking,
    allow,
    deny,
    denied,
  };
};
