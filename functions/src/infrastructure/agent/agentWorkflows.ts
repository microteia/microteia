import type { WorkflowDefinition } from '../../domain/entities/Workflow';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveEntity } from '../../domain/schema/screenEntity';
import {
  describeParameters,
  indexStepCatalog,
  summarizeSteps,
  workflowDataAccess,
  workflowIdempotency,
  workflowOutputs,
} from '../../domain/schema/agent/agentWorkflow';
import type { AgentParameter } from '../../domain/schema/agent/agentWorkflow';
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

/** A automação como `describe_workflow` a devolve. */
export const describeAgentWorkflow = async (
  definition: WorkflowDefinition,
  ctx: SchemaContext,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>> => {
  const steps = await stepCatalog();
  const summary = summarizeSteps(catalog, steps, definition.steps ?? []);
  const access = workflowDataAccess(summary, uniqueKeysOf(ctx));
  return {
    workflow: definition.id,
    name: resolveLabel(catalog, definition.name),
    ...(definition.description ? { description: resolveLabel(catalog, definition.description) } : {}),
    enabled: definition.enabled !== false,
    parameters: describeParameters(catalog, definition.parameters),
    // A condição de entrada FALSA termina a execução como SUCCESS sem rodar passo nenhum. Dizê-la é
    // o que permite ao modelo entender um "deu certo e nada aconteceu" sem desconfiar do resto.
    ...(definition.condition && definition.condition.kind !== 'AlwaysTrue' ? { runsOnlyWhen: definition.condition } : {}),
    dataAccess: access,
    ...workflowIdempotency(summary, access, steps),
    steps: summary,
    output: workflowOutputs(catalog, steps, definition.steps ?? []),
  };
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
