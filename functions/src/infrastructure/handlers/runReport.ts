import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { getDI } from '../di/container';
import { getDb } from '../firebase/initFirebase';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_REPORTS_MANAGE } from '../../domain/schema/access';
import { FirestoreWorkflowQueryRepository } from '../../data/services/FirestoreWorkflowQueryRepository';
import { FirestoreWorkflowRecordFetcher } from '../../data/services/FirestoreWorkflowRecordFetcher';
import type { WorkflowQueryDeps } from '../workflow/query/runWorkflowQuery';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import type { ReportResult } from '../../domain/schema/report/reportResult';
import type { ReportSpecIssue } from '../../domain/schema/report/validateReportSpec';
import { requireReportAccess, runReportQuery } from '../report/runReportQuery';
import { tenantTimeZone } from '../settings/tenantTimeZone';

interface RunReportRequest {
  tenantId: string;
  /** A chave do relatório gravado. Excludente com `spec`. */
  reportId?: string;
  /** O spec CRU — a pré-visualização da autoria. Exige `reports.manage`. */
  spec?: ReportSpec;
  /** Os valores que o leitor preencheu nos filtros declarados. */
  prompts?: Record<string, unknown>;
}

interface RunReportResponse {
  result: ReportResult | null;
  /** Avisos: o que degradou sem impedir o relatório de rodar. */
  issues: ReportSpecIssue[];
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

/**
 * Executa um relatório e devolve o AGREGADO — nunca as linhas.
 *
 * É por isso que a agregação acontece aqui e não no navegador: os 2000 registros varridos não
 * atravessam a rede, e o que o leitor recebe é o número que ele pediu.
 *
 * O `spec` cru existe para a pré-visualização da autoria, e ele NÃO é atalho de privilégio: a
 * leitura de cada coleção é cobrada do mesmo jeito, e ele exige `reports.manage` por cima — sem
 * isso, o preview seria a porta de executar qualquer agregação escapando do `access.permission` de
 * todo relatório do escritório.
 */
export const runReport = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<RunReportResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, reportId, spec: rawSpec, prompts } = request.data as RunReportRequest;
    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }
    if ((reportId === undefined) === (rawSpec === undefined)) {
      throw new HttpsError('invalid-argument', '@core.reports/handler.target.ambiguous');
    }

    const userId = request.auth.uid;
    const di = getDI();
    const db = getDb();

    let spec: ReportSpec;
    if (rawSpec !== undefined) {
      await requirePermission(tenantId, userId, PERMISSION_REPORTS_MANAGE);
      spec = rawSpec;
    } else {
      const snapshot = await db.doc(`tenants/${tenantId}/reports/${reportId}`).get();
      if (!snapshot.exists) {
        throw new HttpsError('not-found', '@core.reports/handler.not-found', { messageParams: { id: reportId ?? '' } });
      }
      const stored = (snapshot.data() as { spec?: ReportSpec } | undefined)?.spec;
      if (!stored) {
        throw new HttpsError('failed-precondition', '@core.reports/handler.spec.missing');
      }
      spec = stored;
    }

    const deps: WorkflowQueryDeps = {
      queryRepository: new FirestoreWorkflowQueryRepository(db),
      fetcher: new FirestoreWorkflowRecordFetcher(db),
      screenProvider: di.getScreenDefinitionCache(),
    };

    // A permissão vem ANTES de qualquer leitura de dado: a PRÓPRIA do relatório, quando declarada, e
    // a leitura de cada coleção — inclusive as alcançadas por referência. `requirePermission` lança
    // `permission-denied`: falha fechada.
    const schema = await deps.screenProvider.getSchemaContext(tenantId);
    // O conjunto CONCEDIDO volta da mesma leitura que autorizou: é ele que o `hasPermission` de um
    // filtro por expressão consulta. Com o ator vazio, a pergunta respondia NÃO a tudo — e num filtro
    // de linha isso não é um botão que some, é uma linha que sai da conta.
    const permissions = await requireReportAccess(spec, schema, tenantId, userId);

    const logs: string[] = [];
    const logger: WorkflowLogger = {
      info: (message) => logs.push(message),
      warn: (message) => logs.push(message),
      error: (message) => logs.push(message),
    };

    const context: WorkflowContext = {
      event: { id: '', tenantId, name: 'report.run', payload: prompts ?? {}, timestamp: new Date() },
      outputs: {},
      variables: {},
      services: { logger, now: () => new Date(), timeZone: await tenantTimeZone(tenantId, userId) },
      logger,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
      actor: await identifyActor(userId, 'ui', permissions),
      input: prompts ?? {},
    };

    const outcome = await runReportQuery({ spec, context, deps, prompts });

    return outcome.ok
      ? { result: outcome.value, issues: outcome.issues, error: null }
      : { result: null, issues: outcome.issues ?? [], error: outcome.error, errorParams: outcome.errorParams };
  },
);
