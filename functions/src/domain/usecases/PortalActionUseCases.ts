import type { IPortalRepository, PortalActionDefinition, PortalScreen } from '../repositories/IPortalRepository';
import { permissionDenied } from '../errors/DomainError';
import { normalizeActionOutcome } from '../entities/Action';
import type { ActionStatusCode } from '../entities/Action';
import {
  isPortalRecordVisible,
  evaluatePortalCondition,
  portalActionState,
  portalRecordActions,
  portalRecordDocId,
  type PortalActionScope,
} from '../schema/portal';
import { activeGuest, guestSees } from './PortalAccessUseCases';

/** Um botão do registro aberto no portal, já no idioma do convidado. */
export interface PortalRecordAction {
  id: string;
  title: string;
  icon: string;
  /** A pergunta antes de executar — `null` quando a ação dispara direto. */
  confirmMessage: string | null;
  danger: boolean;
  /** Visível, mas apagado: o `disabledWhen` do escritório vale agora. */
  disabled: boolean;
}

/**
 * O desfecho que o convidado lê — só o status. O `result` e os comandos do fluxo não saem do escritório.
 * A mensagem vazia fica para a casca, que diz "pronto" ou "não foi possível" no idioma do convidado: o
 * catálogo do núcleo, aqui no servidor, só existe no idioma-fonte.
 */
export interface PortalActionOutcome {
  status: { code: ActionStatusCode; message: string };
  /** Os botões depois do fluxo: o que ele gravou pode ter apagado ou escondido algum. */
  actions: PortalRecordAction[];
}

/**
 * O texto do escritório e das extensões no idioma do convidado — título, confirmação, a mensagem do
 * fluxo: uma referência `@ns/chave` é traduzida pelos pacotes instalados; o resto passa intacto.
 */
export type PortalTextResolver = (value: string) => string;

/**
 * Roda o fluxo da ação como o convidado. `ok: false` é o fluxo que não existe mais ou terminou em erro —
 * o motivo fica na execução, que o escritório lê; ao convidado vai a frase de sempre, escrita pela casca.
 */
export type PortalActionRunner = (input: {
  tenantId: string;
  userId: string;
  workflowId: string;
  params: Record<string, unknown>;
}) => Promise<{ ok: true; outputs: Record<string, unknown> } | { ok: false }>;

interface PortalActionRequest {
  tenantId: string;
  userId: string;
  projectionId: string;
  /** O fuso do escritório — o `today()` das condições responde nele. */
  timeZone?: string;
  resolve: PortalTextResolver;
}

interface PortalActionTarget {
  screen: PortalScreen;
  recordId: string;
  record: Record<string, unknown>;
  actions: PortalActionDefinition[];
  scope: PortalActionScope;
}

const denied = () => permissionDenied('@core.tenant/portal.action.unavailable');

/**
 * O registro em que o convidado age, conferido como na alteração: o convite está vivo, ele enxerga a
 * projeção AGORA, o registro ainda passa no `visibleWhen` e a tela declara ações. As ações são lidas a
 * cada pedido — mudar o título ou a condição de uma vale no clique seguinte, sem reprojeção.
 */
const loadTarget = async (repo: IPortalRepository, request: PortalActionRequest): Promise<PortalActionTarget> => {
  const { tenantId, userId, projectionId, timeZone } = request;
  const guest = activeGuest(await repo.getPortalUser(tenantId, userId));
  if (!guest) throw denied();

  const projection = await repo.getProjection(tenantId, projectionId);
  if (!projection || !guestSees(guest, projection)) throw denied();
  if (portalRecordDocId(projection.collection, projection.recordId) !== projectionId) throw denied();

  const screens = await repo.getScreens(tenantId);
  const screen = screens.find((one) => one.collection === projection.collection && one.portal);
  if (!screen?.portal?.actions?.length) throw denied();

  const record = await repo.getRecord(tenantId, projection.collection, projection.recordId);
  const evaluate = (expression: string, values: Record<string, unknown>) => evaluatePortalCondition(expression, values, timeZone);
  if (!record || !isPortalRecordVisible(screen, record, evaluate)) throw denied();

  const actions = portalRecordActions(screen, await repo.getActions(tenantId, screen.viewActionIds ?? []));
  return {
    screen,
    recordId: projection.recordId,
    record,
    actions,
    scope: {
      record,
      collection: screen.collection,
      guest: { id: userId, name: guest.displayName },
      ...(timeZone ? { timeZone } : {}),
    },
  };
};

const buttonsOf = (
  actions: readonly PortalActionDefinition[],
  scope: PortalActionScope,
  resolve: PortalTextResolver,
): PortalRecordAction[] => actions.flatMap((action) => {
  const state = portalActionState(action, scope);
  if (state === 'hidden') return [];
  return [{
    id: action.id,
    title: resolve(action.title),
    icon: action.icon,
    confirmMessage: action.confirmMessage ? resolve(action.confirmMessage) : null,
    danger: action.danger,
    disabled: state === 'disabled',
  }];
});

export type ListPortalRecordActionsUseCase = {
  execute: (input: PortalActionRequest) => Promise<PortalRecordAction[]>;
};

/** Os botões do registro aberto, para ESTE convidado e agora. */
export const makeListPortalRecordActionsUseCase = (repo: IPortalRepository): ListPortalRecordActionsUseCase => ({
  execute: async (request) => {
    const target = await loadTarget(repo, request);
    return buttonsOf(target.actions, target.scope, request.resolve);
  },
});

export type RunPortalRecordActionUseCase = {
  execute: (input: PortalActionRequest & { actionId: string }) => Promise<PortalActionOutcome>;
};

/**
 * O convidado DISPARA uma ação do escritório no registro aberto.
 *
 * Tudo é conferido de novo: o botão foi desenhado antes, e a condição pode ter mudado — a ação precisa
 * estar declarada, servir ao portal e estar habilitada para este registro agora. O fluxo recebe o que
 * recebe no escritório (`action`, `source`, `context`, `recordId`, `isNew`), com o `context` lido do
 * registro gravado, e nunca do pedido: o convidado não escolhe com que dados o fluxo roda.
 *
 * Do desfecho, só o status volta. O `result` e os comandos (`merge`, `save`…) são do formulário do
 * escritório, que o portal não tem — e o `result` pode trazer o que a tela não expõe.
 */
export const makeRunPortalRecordActionUseCase = (
  repo: IPortalRepository,
  run: PortalActionRunner,
): RunPortalRecordActionUseCase => ({
  execute: async ({ actionId, ...request }) => {
    const target = await loadTarget(repo, request);
    const action = target.actions.find((one) => one.id === actionId);
    if (!action?.workflowId || portalActionState(action, target.scope) !== 'enabled') throw denied();

    const outcome = await run({
      tenantId: request.tenantId,
      userId: request.userId,
      workflowId: action.workflowId,
      params: {
        action: action.key,
        source: target.screen.id,
        context: target.record,
        recordId: target.recordId,
        isNew: false,
      },
    });

    // O fluxo pode ter gravado o registro: os botões são refeitos sobre o que está gravado agora.
    const current = await repo.getRecord(request.tenantId, target.screen.collection, target.recordId);
    const actions = current ? buttonsOf(target.actions, { ...target.scope, record: current }, request.resolve) : [];

    if (!outcome.ok) return { status: { code: 'ERROR', message: '' }, actions };
    const { status } = normalizeActionOutcome(outcome.outputs);
    return { status: { code: status.code, message: status.message ? request.resolve(status.message) : '' }, actions };
  },
});
