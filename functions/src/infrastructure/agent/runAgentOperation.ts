import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import type { QueryPredicate, QuerySpec } from '../../domain/schema/querySpec';
import { QUERY_OPERATORS_WITHOUT_VALUE } from '../../domain/schema/querySpec';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { reportRequiredPermissions } from '../../domain/schema/report/reportSpec';
import { grants } from '../../domain/schema/access/memberPermissions';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { ruleIssueParams } from '../../domain/schema/fieldRules';
import { checkAgentInput } from '../../domain/schema/agent/agentInput';
import { AGENT_SEARCH_MAX_RESULTS, AGENT_WORKFLOW_TRIGGERS } from '../../domain/schema/agent/agentOps';
import type { AgentWorkflowTrigger } from '../../domain/schema/agent/agentOps';
import { searchAuditLog } from './agentAuditLog';
import { applyDerivedFields, tableMentionsBusinessDays } from '../../domain/schema/recordRules';
import { withAmbientTimeZone } from '../../domain/schema/clockGate';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';
import { withAmbientBusinessCalendars } from '../../domain/schema/time/businessDaysGate';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { isEmptyRuleValue } from '../../domain/schema/fieldRules';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
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
import { agentRun } from './agentContext';
import { identifyActor } from '../workflow/identifyActor';
import { toPublishedActor } from '../../domain/engine/workflowActor';
import { agentText } from './agentMessages';
import type { AgentText } from './agentMessages';
import { describeScreen, officeScreens } from './describeScreen';
import { authorizeOperation, permissionCharge, resolveTool } from './agentAuthorization';
import type { PreparedParameters } from './agentParameters';
import { ACTION_SYSTEM_PARAMETERS, prepareParameters } from './agentParameters';
import { describeAgentWorkflow, listAgentWorkflows, previewAgentWorkflow, screenActions } from './agentWorkflows';
import type { AgentDocumentOutcome } from './agentDocuments';
import { attachAgentDocument, describeDocuments, listAgentDocuments } from './agentDocuments';

/**
 * Os tetos da varredura para uma pergunta de agente.
 *
 * Maiores que os do motor de automações (300/100) e iguais aos do relatório na varredura, porque um
 * agente pergunta em nome de uma pessoa que está esperando: "achei 300 de talvez mais" é uma resposta
 * pior que uma consulta um pouco mais cara. `complete` continua indo na resposta — é ele que diz ao
 * modelo que estreitar o filtro é necessário, em vez de deixá-lo confiar numa contagem parcial.
 */
const AGENT_QUERY_LIMITS: WorkflowQueryLimits = { maxScan: 2000, maxResults: AGENT_SEARCH_MAX_RESULTS };

/**
 * A recusa, com o DETALHE que permite corrigi-la: as chaves aceitas, cada problema por caminho. A
 * frase diz o primeiro; `details` diz todos, em forma que o modelo lê sem interpretar texto.
 */
export type AgentRefusal = AgentText & { details?: Record<string, unknown> };

export type AgentOperationOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: AgentRefusal };

const refuse = (
  catalog: MessageCatalog,
  ref: string,
  params?: Record<string, string>,
  details?: Record<string, unknown>,
): AgentOperationOutcome =>
  ({ ok: false, error: { ...agentText(catalog, ref, params), ...(details ? { details } : {}) } });

/** Cada problema de regra com a frase resolvida, para o modelo não depender só do primeiro. */
const issueDetails = (catalog: MessageCatalog, issues: readonly RuleIssue[]): Record<string, unknown> => ({
  issues: issues.map((issue) => ({
    path: issue.path,
    label: issue.label,
    ...agentText(catalog, issue.error, issue.errorParams),
  })),
});

/** A recusa de parâmetros mal formados, a mesma para automação e para ação. */
const refuseParameters = (
  catalog: MessageCatalog,
  prepared: Exclude<PreparedParameters, { ok: true }>,
): AgentOperationOutcome => {
  if (prepared.kind === 'unknown') {
    const params = { unknown: prepared.unknown.join(', '), accepted: prepared.accepted.join(', ') };
    return refuse(
      catalog,
      prepared.accepted.length > 0 ? '@core.access/agent.params.unknown' : '@core.access/agent.params.unknown-none',
      params,
      { unknownParams: prepared.unknown, acceptedParams: prepared.accepted },
    );
  }
  return refuse(
    catalog,
    '@core.automation/run.parameters.invalid',
    // `RuleIssue` já É um `DescribableIssue` — tem `label`, `error` e `errorParams`. Remapeá-lo
    // seria a chance de perder um dos três.
    ruleIssueParams(prepared.issues),
    issueDetails(catalog, prepared.issues),
  );
};

const fromDocumentOutcome = (catalog: MessageCatalog, outcome: AgentDocumentOutcome): AgentOperationOutcome =>
  (outcome.ok ? outcome : refuse(catalog, outcome.error, outcome.params));

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const agentTriggerFilter = (value: unknown): AgentWorkflowTrigger | 'all' =>
  (AGENT_WORKFLOW_TRIGGERS as readonly unknown[]).includes(value) ? value as AgentWorkflowTrigger : 'all';

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

  // O esquema publicado é CONFERIDO, e antes de qualquer leitura: um argumento de nome errado era
  // ignorado, e `filters` no lugar de `where` devolvia a coleção inteira como se fosse a resposta.
  const inputIssues = checkAgentInput(tool.inputSchema, input);
  if (inputIssues.length > 0) {
    const [first] = inputIssues;
    return refuse(catalog, first.error, first.params, {
      issues: inputIssues.map((issue) => ({ path: issue.path, ...agentText(catalog, issue.error, issue.params) })),
    });
  }

  const schema = await getDI().getScreenDefinitionCache().getSchemaContext(session.tenantId);
  const authorized = authorizeOperation(session, permissionCharge(schema, tool, input));
  if (!authorized.ok) return refuse(catalog, authorized.error, authorized.params);

  switch (tool.name) {
    case 'list_screens':
      return { ok: true, value: officeScreens(schema, catalog, session) };

    case 'describe_screen': {
      const collection = asText(input.collection);
      const described = describeScreen(schema, catalog, session, collection);
      if (described === null) {
        return refuse(catalog, '@core.automation/mutation.table.unknown', { table: collection });
      }
      const screen = schema.screens.get(collection);
      const [actions, documents] = await Promise.all([
        screen ? screenActions(session.tenantId, screen.id, catalog) : Promise.resolve([]),
        describeDocuments(schema, session.tenantId, collection, catalog),
      ]);
      return {
        ok: true,
        value: {
          ...described,
          ...(actions.length > 0 ? { actions } : {}),
          ...(documents ? { documents } : {}),
        },
      };
    }

    case 'search_records': {
      // `in` sem lista nunca casa com nada (`evaluateResolvedPredicate` exige array), e voltava
      // vazio — que se lê como "não há registro assim".
      const where = Array.isArray(input.where) ? input.where : [];
      const notList = where.findIndex((one) => asRecord(one).op === 'in' && !Array.isArray(asRecord(one).value));
      if (notList >= 0) {
        return refuse(catalog, '@core.access/agent.query.in-needs-list', { path: `where[${notList}].value` });
      }

      const spec: QuerySpec = {
        table: asText(input.collection),
        where: asPredicates(input.where),
        orderBy: asOrderBy(input.orderBy),
        limit: typeof input.limit === 'number' ? input.limit : AGENT_QUERY_LIMITS.maxResults,
        projections: [],
      };
      const { context } = await agentRun(session, tool.name);
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
      const timeZone = await tenantTimeZone(session.tenantId, session.userId);
      const calendars = tableMentionsBusinessDays(schema, asText(input.collection))
        ? await tenantBusinessCalendars(session.tenantId)
        : undefined;
      return {
        ok: true,
        value: {
          id,
          ...withAmbientBusinessCalendars(calendars, () =>
            withAmbientTimeZone(timeZone, () =>
              applyDerivedFields(schema, asText(input.collection), record, new Date()),
            ),
          ),
        },
      };
    }

    case 'create_record':
    case 'update_record': {
      const isUpdate = tool.name === 'update_record';
      const id = asText(input.id);
      if (isUpdate && id === '') return refuse(catalog, '@core.records/record.not-found');

      const { context } = await agentRun(session, tool.name);
      const outcome = await runWorkflowUpsert(
        { table: asText(input.collection), ...(id === '' ? {} : { id }), data: asRecord(input.data) },
        context,
        mutationDeps(),
      );
      return outcome.ok
        ? { ok: true, value: { id: outcome.value.id, created: outcome.value.created, record: outcome.value.record } }
        : refuse(catalog, outcome.error, outcome.errorParams);
    }

    case 'delete_record': {
      const { context } = await agentRun(session, tool.name);
      const outcome = await runWorkflowRemove(
        { table: asText(input.collection), id: asText(input.id) },
        context,
        mutationDeps(),
      );
      return outcome.ok
        ? { ok: true, value: outcome.value }
        : refuse(catalog, outcome.error, outcome.errorParams);
    }

    case 'list_documents':
      return fromDocumentOutcome(
        catalog,
        await listAgentDocuments(schema, session, asText(input.collection), asText(input.recordId), catalog),
      );

    case 'attach_document':
      return fromDocumentOutcome(catalog, await attachAgentDocument(schema, session, input, catalog));

    case 'run_report':
      return runAgentReport(input, session, catalog, schema);

    case 'list_workflows':
      return {
        ok: true,
        value: {
          workflows: await listAgentWorkflows(session.tenantId, catalog, agentTriggerFilter(input.trigger)),
        },
      };

    case 'describe_workflow':
      return describeWorkflowOperation(input, session, catalog, schema);

    case 'run_workflow':
      return startAgentWorkflow(input, session, catalog, schema);

    case 'get_workflow_run':
      return readAgentWorkflowRun(input, session, catalog);

    case 'run_action':
      return runAgentAction(input, session, catalog);

    case 'search_audit_log': {
      const outcome = await searchAuditLog(input, session.tenantId, catalog);
      return outcome.ok ? outcome : refuse(catalog, outcome.error, outcome.params);
    }

    default:
      return refuse(catalog, '@core.automation/handler.action.not-found');
  }
};

/**
 * O relatório, com a leitura cobrada do ACESSO e não do usuário.
 *
 * A lista é `reportRequiredPermissions` — a mesma que `requireReportAccess` cobra, então o que é
 * exigido nunca divergirá: a permissão própria do relatório e as coleções, inclusive as alcançadas
 * por referência. O que muda é de
 * quem se cobra: aquela chama `requirePermission`, que responde pelo conjunto do USUÁRIO, e usá-la
 * aqui faria um relatório ler uma coleção que o teto do token exclui. Mesma pergunta, outro ator.
 */
const runAgentReport = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: SchemaContext,
): Promise<AgentOperationOutcome> => {
  const reportId = asText(input.report);
  const snapshot = await getDb().doc(`tenants/${session.tenantId}/reports/${reportId}`).get();
  if (!snapshot.exists) return refuse(catalog, '@core.reports/handler.not-found', { id: reportId });

  const spec = (snapshot.data() as { spec?: ReportSpec } | undefined)?.spec;
  if (!spec) return refuse(catalog, '@core.reports/handler.spec.missing');

  for (const permission of reportRequiredPermissions(spec, schema)) {
    if (!grants(session.permissions, permission)) {
      return refuse(catalog, '@core.access/permission.denied', { permission });
    }
  }

  const prompts = asRecord(input.prompts);
  const declared = spec.presentation?.prompts ?? [];
  const accepted = declared.map((prompt) => prompt.key);
  const unknown = Object.keys(prompts).filter((key) => !accepted.includes(key));
  if (unknown.length > 0) {
    return refuse(
      catalog,
      accepted.length > 0 ? '@core.access/agent.prompts.unknown' : '@core.access/agent.prompts.unknown-none',
      { unknown: unknown.join(', '), accepted: accepted.join(', ') },
      { unknownFilters: unknown, acceptedFilters: accepted },
    );
  }
  const missing = declared.find((prompt) =>
    prompt.required === true && prompt.default === undefined && isEmptyRuleValue(prompts[prompt.key]));
  if (missing) {
    return refuse(catalog, '@core.access/agent.prompts.required', {
      key: missing.key,
      label: resolveLabel(catalog, missing.label ?? missing.key),
    });
  }

  const { context } = await agentRun(session, 'run_report');
  const outcome = await runReportQuery({ spec, context, deps: queryDeps(), prompts });
  return outcome.ok
    ? { ok: true, value: outcome.value }
    : refuse(catalog, outcome.error, outcome.errorParams);
};

/**
 * A automação é PUBLICADA, não executada — a mesma decisão da callable `runWorkflow`, e não uma
 * limitação deste caminho: levar as permissões no payload persistiria um retrato do acesso de alguém
 * dentro do barramento, e um retrato envelhece. `get_workflow_run` lê o desfecho depois.
 *
 * A IDENTIDADE vai junto, ao lado do payload: quem pediu é um fato que não envelhece, e é o que faz o
 * fluxo gravar o registro em nome do dono do token, com `via: 'agent'`.
 */
const startAgentWorkflow = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: SchemaContext,
): Promise<AgentOperationOutcome> => {
  const workflowId = asText(input.workflow);
  const definition = await getDI().getWorkflowDefinitionRepository().findByRef(session.tenantId, workflowId);
  if (!definition) return refuse(catalog, '@core.admin/processor.workflow-not-found');
  if (definition.eventName !== WORKFLOW_CALLED_EVENT) {
    return refuse(catalog, '@core.admin/processor.workflow-not-callable');
  }

  const prepared = prepareParameters(definition.parameters, asRecord(input.params));

  if (input.dry_run === true) {
    // O ensaio NÃO recusa: ele é a pergunta "isto passaria?", e a resposta inclui o que não passa.
    return {
      ok: true,
      value: {
        dryRun: true,
        valid: prepared.ok,
        ...(prepared.ok ? { params: prepared.data } : {}),
        ...(!prepared.ok && prepared.kind === 'unknown'
          ? { unknownParams: prepared.unknown, acceptedParams: prepared.accepted }
          : {}),
        ...(!prepared.ok && prepared.kind === 'invalid' ? issueDetails(catalog, prepared.issues) : {}),
        ...(await previewAgentWorkflow(definition, schema, catalog)),
      },
    };
  }

  if (!prepared.ok) return refuseParameters(catalog, prepared);

  const eventId = await publishEvent(getDb(), session.tenantId, WORKFLOW_CALLED_EVENT, {
    __targetWorkflowId: workflowId,
    __callDepth: 1,
    ...prepared.data,
  }, toPublishedActor(await identifyActor(session.userId, 'agent', session.permissions)));
  return { ok: true, value: { eventId, status: 'STARTED' } };
};

const describeWorkflowOperation = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: SchemaContext,
): Promise<AgentOperationOutcome> => {
  const definition = await getDI().getWorkflowDefinitionRepository()
    .findByRef(session.tenantId, asText(input.workflow));
  // A de gatilho também é descrita: `callable: false` e o `trigger` dizem que ela não se inicia, e o
  // relógio responde "quando roda?" e "rodou?". Quem a tentar iniciar continua recusado em `run_workflow`.
  if (!definition) return refuse(catalog, '@core.admin/processor.workflow-not-found');
  return { ok: true, value: await describeAgentWorkflow(definition, schema, catalog) };
};

const readAgentWorkflowRun = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<AgentOperationOutcome> => {
  const eventId = asText(input.eventId);
  const executions = await getDI().getWorkflowExecutionRepository()
    .findByEventId(session.tenantId, eventId);

  // Sem execução E sem evento é um id que ninguém publicou — e "pending" para sempre faria o modelo
  // esperar por uma automação que nunca vai começar.
  if (executions.length === 0) {
    const event = await getDb().doc(`tenants/${session.tenantId}/workflow_events/${eventId}`).get();
    if (!event.exists) return refuse(catalog, '@core.access/agent.run.not-found', { eventId });
  }

  return {
    ok: true,
    value: {
      // Vazio não é "nada vai acontecer": a publicação e a execução são invocações diferentes, e
      // dizê-lo evita o modelo concluir que a automação falhou quando ela ainda não começou.
      pending: executions.length === 0,
      // `WAITING` não terminou: a MESMA execução retoma em `resumeAt`, no mesmo histórico.
      finished: executions.length > 0
        && executions.every((execution) => execution.status !== 'RUNNING' && execution.status !== 'WAITING'),
      runs: executions.map((execution) => ({
        id: execution.id,
        workflow: execution.workflowDefinitionId,
        status: execution.status,
        startedAt: execution.startedAt.toISOString(),
        ...(execution.finishedAt ? { finishedAt: execution.finishedAt.toISOString() } : {}),
        ...(execution.status === 'WAITING' && execution.resumeAt ? { resumeAt: execution.resumeAt.toISOString() } : {}),
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
  const target = await di.getWorkflowDefinitionRepository().findByRef(session.tenantId, action.workflowId);
  if (!target) return refuse(catalog, '@core.automation/handler.action.workflow-invalid');

  const system: Record<(typeof ACTION_SYSTEM_PARAMETERS)[number], unknown> = {
    action: action.key ?? '',
    source: 'agent',
    context: {},
    recordId: asText(input.recordId) || null,
    isNew: false,
  };
  // Os informados primeiro: os cinco do sistema são a última palavra, como em `runAction`.
  const prepared = prepareParameters(target.parameters, asRecord(input.params), system);
  if (!prepared.ok) return refuseParameters(catalog, prepared);

  await di.ensureWorkflowStepsRegistered();

  const result = await di.getRunCalledWorkflowUseCase().execute({
    tenantId: session.tenantId,
    targetWorkflowId: action.workflowId,
    params: { ...prepared.data, ...system },
    // A INTERSEÇÃO, e não o conjunto do usuário: é dela que `hasPermission(...)` responde dentro de
    // um Script ou de uma expressão da ação.
    actor: await identifyActor(session.userId, 'agent', session.permissions),
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
