import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { AGENT_ENFORCED, AGENT_UNENFORCED } from '../../domain/schema/agent/agentOps';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access/kernelPermissions';
import { grants } from '../../domain/schema/access/memberPermissions';
import { getDb } from '../firebase/initFirebase';
import type { AgentSession } from './authenticateAgent';

/**
 * O primeiro documento que o agente deve ler.
 *
 * Ele diz o que este acesso alcança E o que este caminho não confere. A segunda metade existe porque
 * a assimetria é real: um campo escondido por condição não está escondido aqui, e um agente que
 * gravasse nele concluiria — corretamente, a partir do silêncio — que ele era livre. Dizer isso é
 * mais barato que descobrir depois.
 */
export const officeInfo = (
  session: AgentSession,
  officeName: string,
): Record<string, unknown> => ({
  office: officeName,
  accessName: session.grantName,
  /** O que ESTE acesso pode. É a interseção, não o teto — ver `effectiveAgentPermissions`. */
  permissions: session.permissions,
  expiresAt: session.expiresAt === null ? null : session.expiresAt.toISOString(),
  /**
   * O teto declarado quando ele é MAIOR que o efetivo. A diferença quase sempre significa que quem
   * emitiu o acesso perdeu um perfil desde então — e é a explicação de uma ferramenta que recusa
   * mesmo estando na lista do acesso.
   */
  ...(session.ceiling.some((one) => !session.permissions.includes(one))
    ? { declaredButNotHeld: session.ceiling.filter((one) => !session.permissions.includes(one)) }
    : {}),
  enforced: AGENT_ENFORCED,
  notEnforced: AGENT_UNENFORCED,
});

/** Os relatórios que este acesso pode rodar, e o que cada um pergunta antes de rodar. */
export const officeReports = async (
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>[]> => {
  const snapshot = await getDb().collection(`tenants/${session.tenantId}/reports`).get();

  return snapshot.docs
    .filter((doc) => doc.get('enabled') !== false)
    .map((doc) => {
      // Os filtros que o relatório PERGUNTA vivem em `presentation.prompts`, e o valor de cada um é
      // pedido no formato do CAMPO que ele aponta — por isso `path` e `op` vão na resposta: é o que
      // permite ao agente descobrir o tipo com `describe_screen` em vez de tentar adivinhar.
      const prompts = ((doc.get('spec') ?? {}) as ReportSpec).presentation?.prompts ?? [];
      return {
        report: doc.get('key') ?? doc.id,
        title: resolveLabel(catalog, String(doc.get('title') ?? doc.id)),
        ...(doc.get('description') ? { description: resolveLabel(catalog, String(doc.get('description'))) } : {}),
        ...(prompts.length > 0
          ? {
            filters: prompts.map((prompt) => ({
              key: prompt.key,
              label: resolveLabel(catalog, prompt.label ?? prompt.key),
              field: prompt.path,
              op: prompt.op,
              required: prompt.required === true,
            })),
          }
          : {}),
      };
    })
    .sort((left, right) => String(left.report).localeCompare(String(right.report)));
};

/**
 * As automações que este acesso pode iniciar.
 *
 * Só as CHAMÁVEIS: um fluxo que nasce de um gatilho não é iniciável por ninguém, nem pela tela, e
 * listá-lo faria o agente tentar. É o mesmo filtro que a callable `runWorkflow` aplica.
 */
export const officeWorkflows = async (
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>[]> => {
  if (!grants(session.permissions, PERMISSION_AUTOMATION_RUN)) return [];

  const snapshot = await getDb()
    .collection(`tenants/${session.tenantId}/workflow_definitions`)
    .where('eventName', '==', WORKFLOW_CALLED_EVENT)
    .get();

  return snapshot.docs
    .filter((doc) => doc.get('enabled') !== false)
    .map((doc) => {
      const parameters = doc.get('parameters');
      return {
        workflow: doc.id,
        name: resolveLabel(catalog, String(doc.get('name') ?? doc.id)),
        ...(Array.isArray(parameters) && parameters.length > 0
          ? {
            parameters: (parameters as { name?: string; type?: string; required?: boolean }[]).map((one) => ({
              name: one.name ?? '',
              type: one.type ?? 'String',
              required: one.required === true,
            })),
          }
          : {}),
      };
    })
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
};
