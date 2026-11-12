import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { getDI } from '../di/container';
import { getDb } from '../firebase/initFirebase';
import { requireAnyPermission } from './shared/requirePermission';
import { PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL } from '../../domain/schema/access';
import { FirestoreWorkflowQueryRepository } from '../../data/services/FirestoreWorkflowQueryRepository';
import { FirestoreWorkflowRecordFetcher } from '../../data/services/FirestoreWorkflowRecordFetcher';
import type { WorkflowQueryDeps } from '../workflow/query/runWorkflowQuery';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import type { ReportResult } from '../../domain/schema/report/reportResult';
import type { ReportDrillResult, ReportDrillTarget } from '../../domain/schema/report/aggregateRows';
import type { ReportSpecIssue } from '../../domain/schema/report/validateReportSpec';
import { requireReportAccess, runReportQuery } from '../report/runReportQuery';
import { PERSONAL_REPORTS_COLLECTION } from '../../domain/schema/report/personalReport';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';

interface RunReportRequest {
  tenantId: string;
  /** A chave do relatório gravado. Excludente com `spec`. */
  reportId?: string;
  /** `reportId` é de um relatório PESSOAL: só o autor o executa. */
  personal?: boolean;
  /** O spec CRU — a pré-visualização da autoria. Exige `reports.manage` ou `reports.personal`. */
  spec?: ReportSpec;
  /** Os valores que o leitor preencheu nos filtros declarados. */
  prompts?: Record<string, unknown>;
  /** O recorte clicado: devolve, além do agregado, os registros dele. */
  drill?: ReportDrillTarget;
}

interface RunReportResponse {
  result: ReportResult | null;
  /** Avisos: o que degradou sem impedir o relatório de rodar. */
  issues: ReportSpecIssue[];
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
  /**
   * Só com `drill` no pedido: os registros do recorte clicado. É a única exceção ao "nunca as linhas",
   * e ela é limitada ao que o leitor pediu para ver e ao teto de registros do relatório.
   */
  drill?: ReportDrillResult;
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

    const { tenantId, reportId, personal, spec: rawSpec, prompts, drill } = request.data as RunReportRequest;
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
      // Quem escreve relatório pessoal também pré-visualiza: a leitura de cada coleção continua cobrada
      // logo abaixo, então a pré-visualização não lhe mostra nada que o relatório salvo não mostraria.
      await requireAnyPermission(tenantId, request.auth, [PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL]);
      spec = rawSpec;
    } else {
      const collection = personal === true ? PERSONAL_REPORTS_COLLECTION : 'reports';
      const snapshot = await db.doc(`tenants/${tenantId}/${collection}/${reportId}`).get();
      // O relatório pessoal de OUTRO membro responde como inexistente: dizer "não é seu" já contaria
      // que ele existe.
      const foreign = personal === true && (snapshot.data() as { ownerId?: unknown } | undefined)?.ownerId !== userId;
      if (!snapshot.exists || foreign) {
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
    const permissions = await requireReportAccess(spec, schema, tenantId, request.auth);

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
      services: {
        logger,
        now: () => new Date(),
        timeZone: await tenantTimeZone(tenantId, userId),
        businessCalendarsOf: tenantBusinessCalendars,
      },
      logger,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
      actor: await identifyActor(userId, 'ui', permissions),
      // O relatório conta só o que quem o roda vê: um total que incluísse o registro que a regra lhe
      // esconde contaria o sigilo dele.
      reader: { uid: userId, permissions },
      input: prompts ?? {},
    };

    const outcome = await runReportQuery({ spec, context, deps, prompts, drill });

    return outcome.ok
      ? { result: outcome.value, issues: outcome.issues, error: null, ...(outcome.drill ? { drill: outcome.drill } : {}) }
      : { result: null, issues: outcome.issues ?? [], error: outcome.error, errorParams: outcome.errorParams };
  },
);
