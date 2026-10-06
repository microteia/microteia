import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import type { QueryPredicate, QuerySpec } from '../../domain/schema/querySpec';
import { QUERY_OPERATORS_WITHOUT_VALUE } from '../../domain/schema/querySpec';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { reportSourceCollections } from '../../domain/schema/report/reportSpec';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { grants } from '../../domain/schema/access/memberPermissions';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import { formatAndValidateParameters } from '../../domain/schema/parameterRules';
import { ruleIssueParams } from '../../domain/schema/fieldRules';
import { applyDerivedFields } from '../../domain/schema/recordRules';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import type { WorkflowQueryLimits } from '../workflow/query/runWorkflowQuery';
import { runWorkflowQuery } from '../workflow/query/runWorkflowQuery';
import { runWorkflowRemove, runWorkflowUpsert } from '../workflow/mutation/runWorkflowMutation';
import { runReportQuery } from '../report/runReportQuery';
import { publishEvent } from '../workflow/publishEvent';
import { FirestoreWorkflowQueryRepository } from '../../data/services/FirestoreWorkflowQueryRepository';
import { FirestoreWorkflowRecordFetcher } from '../../data/services/FirestoreWorkflowRecordFetcher';
import { FirestoreWorkflowMutationRepository } from '../../data/services/FirestoreWorkflowMutationRepository';
import { getDI } from '../di/container';
import { getDb } from '../firebase/initFirebase';
import type { AgentSession } from './authenticateAgent';
import { agentRun, agentWriteActor } from './agentContext';
import { agentText } from './agentMessages';
import type { AgentText } from './agentMessages';
import { describeScreen, officeScreens } from './describeScreen';
import { authorizeOperation, permissionCharge, resolveTool } from './agentAuthorization';

/**
 * Os tetos da varredura para uma pergunta de agente.
 *
 * Maiores que os do motor de automações (300/100) e iguais aos do relatório na varredura, porque um
 * agente pergunta em nome de uma pessoa que está esperando: "achei 300 de talvez mais" é uma resposta
 * pior que uma consulta um pouco mais cara. `complete` continua indo na resposta — é ele que diz ao
 * modelo que estreitar o filtro é necessário, em vez de deixá-lo confiar numa contagem parcial.
 */
const AGENT_QUERY_LIMITS: WorkflowQueryLimits = { maxScan: 2000, maxResults: 200 };

export type AgentOperationOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: AgentText };

const refuse = (catalog: MessageCatalog, ref: string, params?: Record<string, string>): AgentOperationOutcome =>
  ({ ok: false, error: agentText(catalog, ref, params) });

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * O filtro do agente vira o filtro do executor.
 *
 * O executor fala `InputMapping` porque serve o motor de automações, onde um filtro pode apontar para
 * a saída de um passo anterior. Um agente não tem passo anterior: ele manda um valor, e o embrulho
 * `Literal` acontece aqui — uma vez, num lugar — em vez de a forma interna aparecer no esquema da
 * ferramenta.
 */
const asPredicates = (where: unknown): QueryPredicate[] =>
  (Array.isArray(where) ? where : []).map((one) => {
    const raw = asRecord(one);
    const op = asText(raw.op) as QueryPredicate['op'];
    return {
      path: asText(raw.path),
      op,
      ...(QUERY_OPERATORS_WITHOUT_VALUE.includes(op)
        ? {}
        : { value: { kind: 'Literal' as const, value: raw.value } }),
    };
  });

const asOrderBy = (orderBy: unknown): QuerySpec['orderBy'] =>
  (Array.isArray(orderBy) ? orderBy : []).map((one) => {
    const raw = asRecord(one);
    return { path: asText(raw.path), dir: raw.dir === 'desc' ? ('desc' as const) : ('asc' as const) };
  });

// Montados aqui, como `runReport.ts` monta os dele: o DI não expõe estes três, e as cinco
// construções que já existem no contêiner são todas locais ao ponto que as usa.
const queryDeps = () => ({
  queryRepository: new FirestoreWorkflowQueryRepository(getDb()),
  fetcher: new FirestoreWorkflowRecordFetcher(getDb()),
  screenProvider: getDI().getScreenDefinitionCache(),
});

const mutationRepository = () => new FirestoreWorkflowMutationRepository(getDb());

const mutationDeps = () => ({
  mutationRepository: mutationRepository(),
  screenProvider: getDI().getScreenDefinitionCache(),
});

/**
 * Executa uma operação de agente.
 *
 * A ordem é sempre a mesma, e é ela que faz este arquivo ser um ADAPTADOR e não um motor: resolver a
 * ferramenta, cobrar a permissão declarada, traduzir o argumento para a forma do executor, delegar, e
 * resolver a referência que voltou. Nenhuma regra de negócio, nenhuma validação de campo, nenhuma
 * decisão sobre o que pode ser gravado — tudo isso já mora nos executores, e é lá que ele continua
 * valendo para a tela também.
 */
export const runAgentOperation = async (
  name: string,
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<AgentOperationOutcome> => {
  const tool = resolveTool(name);
  if (tool === null) return refuse(catalog, '@core.automation/handler.action.not-found');

  const schema = await getDI().getScreenDefinitionCache().getSchemaContext(session.tenantId);
  const authorized = authorizeOperation(session, permissionCharge(schema, tool, input));
  if (!authorized.ok) return refuse(catalog, authorized.error, authorized.params);

  switch (tool.name) {
    case 'list_screens':
      return { ok: true, value: officeScreens(schema, catalog, session) };

    case 'describe_screen': {
      const described = describeScreen(schema, catalog, session, asText(input.collection));
      return described === null
        ? refuse(catalog, '@core.automation/mutation.table.unknown', { table: asText(input.collection) })
        : { ok: true, value: described };
    }

    case 'search_records': {
      const spec: QuerySpec = {
        table: asText(input.collection),
        where: asPredicates(input.where),
        orderBy: asOrderBy(input.orderBy),
        limit: typeof input.limit === 'number' ? input.limit : AGENT_QUERY_LIMITS.maxResults,
        projections: [],
      };
      const { context } = agentRun(session, tool.name);
      const outcome = await runWorkflowQuery(spec, context, queryDeps(), AGENT_QUERY_LIMITS);
      return outcome.ok
        ? {
          ok: true,
          value: {
            records: outcome.value.results,
            count: outcome.value.count,
            scanned: outcome.value.scanned,
            // O modelo precisa saber que a resposta pode estar incompleta. Sem isto ele trata 200 de
            // talvez 5000 como "todos", e responde uma contagem errada com toda a confiança.
            complete: outcome.value.complete,
          },
        }
        : refuse(catalog, outcome.error, outcome.errorParams);
    }

    case 'get_record': {
      // A tabela é RESOLVIDA, e não usada crua: uma tela cuja coleção não leva o nome dela
      // (`dataCollection`) leria o lugar errado, e uma coleção que não existe responderia "registro
      // não encontrado" em vez de dizer que a tela não existe.
      const resolved = resolveQueryTable(asText(input.collection), schema);
      if (resolved === null) {
        return refuse(catalog, '@core.automation/mutation.table.unknown', { table: asText(input.collection) });
      }

      const id = asText(input.id);
      const record = await mutationRepository().getById(session.tenantId, resolved.physicalCollection, id);
      if (record === null) return refuse(catalog, '@core.records/record.not-found');

      // O MESMO derive que a busca aplica. Sem ele, o mesmo registro voltaria com campos diferentes
      // por `get_record` e por `search_records` — e o agente concluiria que um deles está errado.
      return {
        ok: true,
        value: { id, ...applyDerivedFields(schema, asText(input.collection), record, new Date()) },
      };
    }

    case 'create_record':
    case 'update_record': {
      const isUpdate = tool.name === 'update_record';
      const id = asText(input.id);
      if (isUpdate && id === '') return refuse(catalog, '@core.records/record.not-found');

      const { context } = agentRun(session, tool.name);
      const outcome = await runWorkflowUpsert(
        { table: asText(input.collection), ...(id === '' ? {} : { id }), data: asRecord(input.data) },
        context,
        mutationDeps(),
        { writeActor: agentWriteActor(session) },
      );
      return outcome.ok
        ? { ok: true, value: { id: outcome.value.id, created: outcome.value.created, record: outcome.value.record } }
        : refuse(catalog, outcome.error, outcome.errorParams);
    }

    case 'delete_record': {
      const { context } = agentRun(session, tool.name);
      const outcome = await runWorkflowRemove(
        { table: asText(input.collection), id: asText(input.id) },
        context,
        mutationDeps(),
      );
      return outcome.ok
        ? { ok: true, value: outcome.value }
        : refuse(catalog, outcome.error, outcome.errorParams);
    }

    case 'run_report':
      return runAgentReport(input, session, catalog, schema);

    case 'run_workflow':
      return startAgentWorkflow(input, session, catalog);

    case 'get_workflow_run':
      return readAgentWorkflowRun(input, session, catalog);

    case 'run_action':
      return runAgentAction(input, session, catalog);

    default:
      return refuse(catalog, '@core.automation/handler.action.not-found');
  }
};

/**
 * O relatório, com a leitura cobrada do ACESSO e não do usuário.
 *
 * A enumeração das coleções é `reportSourceCollections` — a mesma função que `requireReportCollections`
 * usa, então o que é alcançado nunca divergirá, inclusive os saltos por referência. O que muda é de
 * quem se cobra: aquela chama `requirePermission`, que responde pelo conjunto do USUÁRIO, e usá-la
 * aqui faria um relatório ler uma coleção que o teto do token exclui. Mesma pergunta, outro ator.
 */
const runAgentReport = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: Awaited<ReturnType<ReturnType<typeof queryDeps>['screenProvider']['getSchemaContext']>>,
): Promise<AgentOperationOutcome> => {
  const reportId = asText(input.report);
  const snapshot = await getDb().doc(`tenants/${session.tenantId}/reports/${reportId}`).get();
  if (!snapshot.exists) return refuse(catalog, '@core.reports/handler.not-found', { id: reportId });

  const spec = (snapshot.data() as { spec?: ReportSpec } | undefined)?.spec;
  if (!spec) return refuse(catalog, '@core.reports/handler.spec.missing');

  for (const collection of reportSourceCollections(spec, schema)) {
    const permission = collectionPermissionId(collection, 'read');
    if (!grants(session.permissions, permission)) {
      return refuse(catalog, '@core.access/permission.denied', { permission });
    }
  }

  const prompts = asRecord(input.prompts);
  const { context } = agentRun(session, 'run_report');
  const outcome = await runReportQuery({ spec, context, deps: queryDeps(), prompts });
  return outcome.ok
    ? { ok: true, value: outcome.value }
    : refuse(catalog, outcome.error, outcome.errorParams);
};

/**
 * A automação é PUBLICADA, não executada — a mesma decisão da callable `runWorkflow`, e não uma
 * limitação deste caminho: levar as permissões no payload persistiria um retrato do acesso de alguém
 * dentro do barramento, e um retrato envelhece. `get_workflow_run` lê o desfecho depois.
 */
const startAgentWorkflow = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<AgentOperationOutcome> => {
  const workflowId = asText(input.workflow);
  const definition = await getDI().getWorkflowDefinitionRepository().findByRef(session.tenantId, workflowId);
  if (!definition) return refuse(catalog, '@core.admin/processor.workflow-not-found');
  if (definition.eventName !== WORKFLOW_CALLED_EVENT) {
    return refuse(catalog, '@core.admin/processor.workflow-not-callable');
  }

  const ruled = formatAndValidateParameters(definition.parameters ?? [], asRecord(input.params));
  if (ruled.issues.length > 0) {
    return refuse(
      catalog,
      '@core.automation/mutation.upsert.invalid',
      // `RuleIssue` já É um `DescribableIssue` — tem `label`, `error` e `errorParams`. Remapeá-lo
      // seria a chance de perder um dos três.
      ruleIssueParams(ruled.issues),
    );
  }

  const eventId = await publishEvent(getDb(), session.tenantId, WORKFLOW_CALLED_EVENT, {
    __targetWorkflowId: workflowId,
    __callDepth: 1,
    ...ruled.data,
  });
  return { ok: true, value: { eventId, status: 'STARTED' } };
};

const readAgentWorkflowRun = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<AgentOperationOutcome> => {
  const executions = await getDI().getWorkflowExecutionRepository()
    .findByEventId(session.tenantId, asText(input.eventId));

  return {
    ok: true,
    value: {
      // Vazio não é "nada vai acontecer": a publicação e a execução são invocações diferentes, e
      // dizê-lo evita o modelo concluir que a automação falhou quando ela ainda não começou.
      pending: executions.length === 0,
      runs: executions.map((execution) => ({
        id: execution.id,
        workflow: execution.workflowDefinitionId,
        status: execution.status,
        startedAt: execution.startedAt.toISOString(),
        ...(execution.finishedAt ? { finishedAt: execution.finishedAt.toISOString() } : {}),
        // O log do motor é escrito como REFERÊNCIA, e é aqui que ele vira frase. Sem isto o agente
        // receberia `@core.automation/condition.field.eval-failed` como explicação.
        log: execution.logs.map((entry) => ({
          level: entry.level,
          ...agentText(catalog, entry.message, entry.messageParams),
        })),
        outputs: execution.outputs,
      })),
    },
  };
};

/** A ação roda em processo, e por isso ela — ao contrário da automação — devolve o desfecho. */
const runAgentAction = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<AgentOperationOutcome> => {
  const actionId = asText(input.action);
  const snapshot = await getDb().doc(`tenants/${session.tenantId}/actions/${actionId}`).get();
  if (!snapshot.exists) return refuse(catalog, '@core.automation/handler.action.not-found');

  const action = snapshot.data() as { key?: string; workflowId?: string; enabled?: boolean };
  if (action.enabled === false) return refuse(catalog, '@core.automation/handler.action.disabled');
  if (!action.workflowId) return refuse(catalog, '@core.automation/handler.action.no-workflow');

  const di = getDI();
  await di.ensureWorkflowStepsRegistered();

  const result = await di.getRunCalledWorkflowUseCase().execute({
    tenantId: session.tenantId,
    targetWorkflowId: action.workflowId,
    params: {
      // Os informados primeiro: os cinco do sistema são a última palavra, como em `runAction`.
      ...asRecord(input.params),
      action: action.key ?? '',
      source: 'agent',
      context: {},
      recordId: asText(input.recordId) || null,
      isNew: false,
    },
    // A INTERSEÇÃO, e não o conjunto do usuário: é dela que `hasPermission(...)` responde dentro de
    // um Script ou de uma expressão da ação.
    actor: { userId: session.userId, permissions: session.permissions },
    callDepth: 1,
  });

  if (!result.found) return refuse(catalog, '@core.automation/handler.action.workflow-invalid');

  return {
    ok: true,
    value: {
      status: result.status,
      executionId: result.executionId,
      outputs: result.outputs ?? {},
    },
  };
};

export { officeScreens };
