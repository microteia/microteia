import type { WorkflowDefinition } from '../../domain/entities/Workflow';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveEntity } from '../../domain/schema/screenEntity';
import {
  describeParameters,
  describeWorkflowTrigger,
  indexStepCatalog,
  summarizeSteps,
  workflowDataAccess,
  workflowIdempotency,
  workflowOutputs,
  workflowPauses,
} from '../../domain/schema/agent/agentWorkflow';
import type { AgentParameter, AgentTriggerDescription } from '../../domain/schema/agent/agentWorkflow';
import type { AgentWorkflowTrigger } from '../../domain/schema/agent/agentOps';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import type { WorkflowClockLastRun } from '../../domain/schema/workflowClock';
import { stepRegistry } from '../../domain/engine/StepRegistry';
import { getDI } from '../di/container';
import { getDb } from '../firebase/initFirebase';
import { ACTION_SYSTEM_PARAMETERS } from './agentParameters';

/**
 * O catálogo de passos como o MOTOR o enxerga: o do kernel e o que estiver registrado por cima.
 * Ler o registro, e não só o catálogo fixo, é o que deixa um passo trazido por extensão ser
 * descrito pelo nome dele em vez de virar "efeito desconhecido".
 */
const stepCatalog = async () => {
  await getDI().ensureWorkflowStepsRegistered();
  return indexStepCatalog(stepRegistry.list());
};

const uniqueKeysOf = (ctx: SchemaContext) => (collection: string): string[] =>
  (resolveEntity(ctx, collection)?.keys ?? []).map((key) => key.name);

const describeLastRun = (lastRun: WorkflowClockLastRun): Record<string, unknown> => ({
  scheduledFor: lastRun.scheduledFor.toISOString(),
  ranAt: lastRun.ranAt.toISOString(),
  outcome: lastRun.outcome,
  ...(lastRun.skipReason ? { skipReason: lastRun.skipReason } : {}),
  ...(lastRun.eventId ? { eventId: lastRun.eventId } : {}),
  ...(lastRun.records === null ? {} : { records: lastRun.records }),
});

/**
 * O que o SERVIDOR vai fazer com uma automação de horário ou de data — a mesma entrada que o bloco
 * "Relógio do servidor" do editor lê. Sem entrada, `scheduled: false`: a automação desligada, ou
 * recém-gravada e ainda não sincronizada, não tem disparo marcado, e dizê-lo é melhor que inventar um.
 */
const describeClock = async (tenantId: string, definitionId: string): Promise<Record<string, unknown>> => {
  const entry = await getDI().getWorkflowClockDeps().repository.find(tenantId, definitionId);
  if (!entry) return { scheduled: false };
  return {
    scheduled: true,
    nextRunAt: entry.nextRunAt.toISOString(),
    timeZone: entry.timeZone,
    ...(entry.lastRun ? { lastRun: describeLastRun(entry.lastRun) } : {}),
  };
};

const runsOnClock = (trigger: AgentTriggerDescription): boolean =>
  trigger.kind === 'schedule' || trigger.kind === 'date-reached';

/** A automação como `describe_workflow` a devolve. */
export const describeAgentWorkflow = async (
  definition: WorkflowDefinition,
  ctx: SchemaContext,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>> => {
  const steps = await stepCatalog();
  const summary = summarizeSteps(catalog, steps, definition.steps ?? []);
  const access = workflowDataAccess(summary, uniqueKeysOf(ctx));
  const pausesAt = workflowPauses(summary);
  const trigger = describeWorkflowTrigger(definition);
  return {
    workflow: definition.id,
    name: resolveLabel(catalog, definition.name),
    ...(definition.description ? { description: resolveLabel(catalog, definition.description) } : {}),
    enabled: definition.enabled !== false,
    callable: trigger.kind === 'called',
    trigger,
    ...(runsOnClock(trigger) ? { clock: await describeClock(definition.tenantId, definition.id) } : {}),
    parameters: describeParameters(catalog, definition.parameters),
    // A condição de entrada FALSA termina a execução como SUCCESS sem rodar passo nenhum. Dizê-la é
    // o que permite ao modelo entender um "deu certo e nada aconteceu" sem desconfiar do resto.
    ...(definition.condition && definition.condition.kind !== 'AlwaysTrue' ? { runsOnlyWhen: definition.condition } : {}),
    dataAccess: access,
    ...workflowIdempotency(summary, access, steps),
    ...(pausesAt.length > 0 ? { pausesAt } : {}),
    steps: summary,
    output: workflowOutputs(catalog, steps, definition.steps ?? []),
  };
};

/**
 * Todas as automações do escritório, com o gatilho de cada uma. A lista do recurso `office/workflows`
 * continua só com as chamáveis — ela responde "o que posso iniciar?"; esta responde "o que existe e
 * quando roda?", que é a pergunta que uma automação de horário ou de data provoca.
 */
export const listAgentWorkflows = async (
  tenantId: string,
  catalog: MessageCatalog,
  filter: AgentWorkflowTrigger | 'all',
): Promise<Record<string, unknown>[]> => {
  const snapshot = await getDb().collection(`tenants/${tenantId}/workflow_definitions`).get();
  return snapshot.docs
    .map((doc) => {
      const trigger = describeWorkflowTrigger({
        eventName: String(doc.get('eventName') ?? ''),
        schedule: doc.get('schedule') ?? undefined,
        dateReached: doc.get('dateReached') ?? undefined,
      });
      const description = doc.get('description');
      return {
        workflow: doc.id,
        name: resolveLabel(catalog, String(doc.get('name') ?? doc.id)),
        ...(typeof description === 'string' && description !== '' ? { description: resolveLabel(catalog, description) } : {}),
        enabled: doc.get('enabled') !== false,
        callable: doc.get('eventName') === WORKFLOW_CALLED_EVENT,
        trigger,
      };
    })
    .filter((one) => filter === 'all' || one.trigger.kind === filter)
    .sort((left, right) => left.name.localeCompare(right.name));
};

/** O que `run_workflow` com `dry_run` informa, sem publicar nada. */
export const previewAgentWorkflow = async (
  definition: WorkflowDefinition,
  ctx: SchemaContext,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>> => {
  const described = await describeAgentWorkflow(definition, ctx, catalog);
  return {
    wouldWrite: (described.dataAccess as { writes: unknown }).writes,
    wouldDelete: (described.dataAccess as { deletes: unknown }).deletes,
    idempotent: described.idempotent,
    because: described.because,
  };
};

export interface AgentScreenAction {
  action: string;
  title: string;
  danger: boolean;
  confirm?: string;
  workflow: string;
  parameters: AgentParameter[];
}

/**
 * As ações de registro que uma tela oferece — o que `run_action` recebe, e que não era dito em lugar
 * nenhum: a ferramenta existia e o agente não tinha como descobrir um id que ela aceitasse.
 *
 * Só as que rodam uma automação. Uma ação de COMANDO (copiar link, duplicar, excluir) é gesto de
 * tela, e não há o que ela execute no servidor.
 */
export const screenActions = async (
  tenantId: string,
  screenId: string,
  catalog: MessageCatalog,
): Promise<AgentScreenAction[]> => {
  const db = getDb();
  const screen = await db.doc(`tenants/${tenantId}/screenDefinitions/${screenId}`).get();
  if (!screen.exists) return [];

  const ids = [
    ...new Set([
      ...((screen.get('viewActionIds') ?? []) as string[]),
      ...((screen.get('cardActionIds') ?? []) as string[]),
    ]),
  ].filter((id) => typeof id === 'string' && id !== '');
  if (ids.length === 0) return [];

  const snapshots = await db.getAll(...ids.map((id) => db.doc(`tenants/${tenantId}/actions/${id}`)));
  const definitions = getDI().getWorkflowDefinitionRepository();

  const actions = await Promise.all(snapshots
    .filter((snapshot) => snapshot.exists)
    .map(async (snapshot): Promise<AgentScreenAction | null> => {
      const data = snapshot.data() as {
        title?: string;
        workflowId?: string;
        command?: string | null;
        enabled?: boolean;
        danger?: boolean;
        confirmMessage?: string | null;
      };
      if (data.enabled === false || data.command || !data.workflowId) return null;
      const target = await definitions.findByRef(tenantId, data.workflowId);
      if (!target) return null;
      return {
        action: snapshot.id,
        title: resolveLabel(catalog, data.title ?? snapshot.id),
        danger: data.danger === true,
        ...(data.confirmMessage ? { confirm: resolveLabel(catalog, data.confirmMessage) } : {}),
        workflow: data.workflowId,
        parameters: describeParameters(
          catalog,
          (target.parameters ?? []).filter((one) => !(ACTION_SYSTEM_PARAMETERS as readonly string[]).includes(one.key)),
        ),
      };
    }));

  return actions.filter((one): one is AgentScreenAction => one !== null);
};
