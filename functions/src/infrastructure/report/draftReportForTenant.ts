import { getDI } from '../di/container';
import { AIResponseFormatError } from '../../domain/usecases/CallAIUseCase';
import { draftLookupCollections, draftReportSpec } from '../../domain/services/aiReportDraft';
import type { ReportDraft } from '../../domain/services/aiReportDraft';
import { agentCatalog, agentText } from '../agent/agentMessages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { REPORT_MAX_SCAN } from './reportLimits';

export type TenantReportDraftOutcome =
  | { ok: true; draft: ReportDraft }
  /** `error` é REFERÊNCIA de mensagem; `kind` diz a quem chama que código HTTP ela merece. */
  | { ok: false; error: string; errorParams?: Record<string, string>; kind: 'refused' | 'failed' };

/**
 * O rascunho de relatório por IA de um escritório: as telas, as opções das listas, a conexão padrão de
 * IA e a segunda volta com os motivos em texto. Uma função só para as duas portas — a callable da tela e
 * o `draft_report` do MCP —, para o agente nunca receber um rascunho pior que a tela.
 *
 * Não confere permissão: cada porta cobra a sua (a sessão do usuário, o teto do acesso de agente).
 */
export const draftReportForTenant = async (tenantId: string, description: string): Promise<TenantReportDraftOutcome> => {
  const di = getDI();
  try {
    const schema = await di.getScreenDefinitionCache().getSchemaContext(tenantId);
    // A lista que falha não derruba o rascunho: o campo só chega ao modelo sem as opções.
    const lookups = new Map(await Promise.all(draftLookupCollections(schema).map(async (collection) => [
      collection,
      await di.getPortalRepository().getLookupOptions(tenantId, collection)
        .then((options) => options.map((option) => ({ key: option.key, label: option.label })))
        .catch(() => []),
    ] as const)));
    const catalog = agentCatalog([], DEFAULT_LOCALE);
    const outcome = await draftReportSpec({
      callAI: di.getCallAIUseCase(),
      credentials: await di.getAIConnectionRepository().getDefaultCredentials(tenantId),
      description,
      schema,
      scanCeiling: REPORT_MAX_SCAN,
      lookups,
      describeIssue: (issue) => agentText(catalog, issue.error, issue.errorParams).text,
    });
    return outcome.ok
      ? { ok: true, draft: outcome.draft }
      : { ok: false, error: outcome.error, errorParams: { detail: outcome.detail ?? '' }, kind: 'refused' };
  } catch (error) {
    if (error instanceof AIResponseFormatError) {
      return {
        ok: false,
        error: error.truncated ? '@core.automation/step.ai.response-truncated' : '@core.automation/step.ai.response-not-json',
        kind: 'failed',
      };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error), kind: 'failed' };
  }
};

/** Há conexão padrão com chave? Sem chamar o modelo; sem ela, a REFERÊNCIA do motivo. */
export const reportDraftAvailability = async (tenantId: string): Promise<{ available: boolean; reason?: string }> => {
  try {
    await getDI().getAIConnectionRepository().getDefaultCredentials(tenantId);
    return { available: true };
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith('@') ? error.message : '@core.automation/ai.no-default-connection';
    return { available: false, reason };
  }
};
