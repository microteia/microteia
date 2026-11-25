import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { ReportPrompt, ReportSpec } from '../../domain/schema/report/reportSpec';
import { reportOpenPermissions, reportVouchOf } from '../../domain/schema/report/reportDoor';
import { isSnapshotReport, snapshotSourceSpec } from '../../domain/schema/report/reportSnapshot';
import { PERSONAL_REPORTS_COLLECTION } from '../../domain/schema/report/personalReport';
import { AGENT_ENFORCED, AGENT_UNENFORCED } from '../../domain/schema/agent/agentOps';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access/kernelPermissions';
import { grants } from '../../domain/schema/access/memberPermissions';
import { artifactAccessOf, workflowRunPermissions } from '../../domain/schema/access/artifactAccess';
import type { WorkflowParameter } from '../../domain/entities/Workflow';
import { describeParameters } from '../../domain/schema/agent/agentWorkflow';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import { parsePath, resolvePath } from '../../domain/schema/pathResolver';
import { getDI } from '../di/container';
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

/**
 * O tipo do valor que um filtro de relatório pede — o do CAMPO que ele aponta, resolvido pela mesma
 * gramática de caminho da consulta. Sem isto o agente via `field` e `op` e tinha de ir a
 * `describe_screen` só para saber se mandava texto, data ou id.
 */
const promptValueShape = (ctx: SchemaContext, table: string, prompt: ReportPrompt): Record<string, unknown> => {
  const resolved = resolveQueryTable(table, ctx);
  if (!resolved) return {};
  const resolution = resolvePath(ctx, resolved.root, parsePath(prompt.path));
  if (!resolution.valid) return {};
  const node = resolution.node;
  const list = prompt.op === 'in' ? { list: true } : {};
  if (node.kind === 'scalar') {
    return { type: node.type, ...(node.lookupCollection ? { optionsFrom: node.lookupCollection } : {}), ...list };
  }
  if (node.kind === 'entity' || node.kind === 'entityList') {
    return { type: 'reference', references: node.collection, ...list };
  }
  return list;
};

/**
 * Os relatórios que este acesso pode rodar, e o que cada um pergunta antes de rodar.
 *
 * "Pode rodar" é a MESMA lista que `run_report` cobra (`reportOpenPermissions`): a permissão
 * própria do relatório e a leitura de cada coleção — ou só a da porta avalizada (#33). Listar um relatório que seria recusado é
 * convidar o agente a tentar.
 */
export const officeReports = async (
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<Record<string, unknown>[]> => {
  const [snapshot, personal, ctx] = await Promise.all([
    getDb().collection(`tenants/${session.tenantId}/reports`).get(),
    // Os PESSOAIS de quem emitiu o acesso — de ninguém mais. O agente age em nome dessa pessoa.
    getDb().collection(`tenants/${session.tenantId}/${PERSONAL_REPORTS_COLLECTION}`).where('ownerId', '==', session.userId).get(),
    getDI().getScreenDefinitionCache().getSchemaContext(session.tenantId),
  ]);
  const personalIds = new Set(personal.docs.map((doc) => doc.id));
  const sharedReports = snapshot.docs.map((doc) => ({ key: String(doc.get('key') ?? doc.id), spec: doc.get('spec') as ReportSpec }));

  return [...snapshot.docs, ...personal.docs]
    .filter((doc) => doc.get('enabled') !== false)
    .filter((doc) => {
      const spec = doc.get('spec') as ReportSpec | undefined;
      if (spec?.dataset === undefined) return false;
      // A mesma pergunta de `run_report`, com a PORTA (#33). A série cuja origem não está à mão fica de
      // fora: `run_report` a recusaria.
      const source = isSnapshotReport(spec) ? snapshotSourceSpec(spec, sharedReports) : undefined;
      const required = reportOpenPermissions({
        id: doc.id,
        sourceId: typeof doc.get('sourceId') === 'string' ? doc.get('sourceId') as string : null,
        ownerId: personalIds.has(doc.id) ? session.userId : null,
        spec,
        vouch: reportVouchOf(doc.get('vouch')),
      }, ctx, source);
      return required !== null && required.every((permission) => grants(session.permissions, permission));
    })
    .map((doc) => {
      // Os filtros que o relatório PERGUNTA vivem em `presentation.prompts`, e o valor de cada um é
      // pedido no formato do CAMPO que ele aponta — por isso o tipo vai junto, resolvido pelo campo.
      const spec = (doc.get('spec') ?? {}) as ReportSpec;
      const prompts = spec.presentation?.prompts ?? [];
      return {
        report: doc.get('key') ?? doc.id,
        title: resolveLabel(catalog, String(doc.get('title') ?? doc.id)),
        ...(personalIds.has(doc.id) ? { personal: true } : {}),
        ...(doc.get('description') ? { description: resolveLabel(catalog, String(doc.get('description'))) } : {}),
        ...(prompts.length > 0
          ? {
            filters: prompts.map((prompt) => ({
              key: prompt.key,
              label: resolveLabel(catalog, prompt.label ?? prompt.key),
              field: prompt.path,
              op: prompt.op,
              required: prompt.required === true,
              ...promptValueShape(ctx, spec.dataset?.table ?? '', prompt),
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
    // A PORTA de cada fluxo (#33): o que este acesso não pode executar não aparece.
    .filter((doc) => workflowRunPermissions({
      id: doc.id,
      sourceId: typeof doc.get('sourceId') === 'string' ? doc.get('sourceId') as string : null,
      access: artifactAccessOf(doc.get('access')),
    }).every((permission) => grants(session.permissions, permission)))
    .map((doc) => {
      // O parâmetro é gravado com `key`, e esta resposta lia `name`: todo parâmetro chegava ao
      // agente como `"name": ""`. A descrição agora é a MESMA de `describe_workflow`.
      const parameters = doc.get('parameters');
      const description = doc.get('description');
      return {
        workflow: doc.id,
        name: resolveLabel(catalog, String(doc.get('name') ?? doc.id)),
        ...(typeof description === 'string' && description !== '' ? { description: resolveLabel(catalog, description) } : {}),
        parameters: Array.isArray(parameters) ? describeParameters(catalog, parameters as WorkflowParameter[]) : [],
      };
    })
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
};
