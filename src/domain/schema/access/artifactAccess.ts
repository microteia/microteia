import { PERMISSION_AUTOMATION_RUN } from './kernelPermissions';
import { isValidAccessPermissionId } from './permission';
import type { PermissionResource } from './resolvePermissions';

/**
 * Quem pode passar por uma PORTA — um workflow chamável, um relatório do escritório (#33).
 *
 * A pessoa entra por uma porta, e é a porta que se concede. Uma tela gera o próprio CRUD; o workflow e o
 * relatório não geravam nada, e por isso não havia como dizer "este perfil roda ESTE fluxo" sem conceder
 * todos (`automation.run`), nem "este perfil vê ESTE relatório" sem conceder a entidade inteira.
 *
 * As duas formas existem porque respondem perguntas diferentes:
 * - `restricted`: a porta GERA a própria permissão. É o caso comum — o escritório não consegue criar
 *   permissão avulsa, e emprestar uma que significa outra coisa (`funcionarios.update` para rodar o
 *   reajuste) um dia concede uma achando que concede a outra.
 * - `permission`: uma permissão que já existe, para quando o vínculo é real ("quem edita Financeiro roda
 *   o fechamento"). Ela só RESTRINGE.
 */
export interface ArtifactAccess {
  restricted?: boolean | null;
  permission?: string | null;
}

/** O que identifica uma porta no catálogo: o `sourceId` sobrevive a reinstalar a extensão dona. */
export interface AccessArtifact {
  id: string;
  sourceId?: string | null;
}

/**
 * O kernel que entende `access` (#33). Num anterior a marca seria ignorada, e o fluxo restrito ficaria
 * aberto a todos — o pacote que a declara precisa exigir este kernel, e o portão do pacote o cobra.
 */
export const ARTIFACT_ACCESS_SINCE_KERNEL = '2.146.0';

export const WORKFLOW_RESOURCE_PREFIX = 'workflow-';
export const REPORT_RESOURCE_PREFIX = 'report-';
export const WORKFLOW_RUN_ACTION = 'run';
export const REPORT_VIEW_ACTION = 'view';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * O pedaço estável do id. O NOME nunca entra: renomear o fluxo não pode tirar a permissão de quem a tem.
 * O recurso leva hífen, e nome de coleção não tem — nunca colide com o CRUD de uma tela.
 */
const artifactToken = (artifact: AccessArtifact): string => {
  const source = artifact.sourceId?.trim();
  return source && TOKEN_PATTERN.test(source) ? source : artifact.id;
};

export const workflowRunResourceId = (workflow: AccessArtifact): string =>
  `${WORKFLOW_RESOURCE_PREFIX}${artifactToken(workflow)}`;

export const workflowRunPermissionId = (workflow: AccessArtifact): string =>
  `${workflowRunResourceId(workflow)}.${WORKFLOW_RUN_ACTION}`;

export const reportViewResourceId = (report: AccessArtifact): string =>
  `${REPORT_RESOURCE_PREFIX}${artifactToken(report)}`;

export const reportViewPermissionId = (report: AccessArtifact): string =>
  `${reportViewResourceId(report)}.${REPORT_VIEW_ACTION}`;

/**
 * O `access` lido de um documento. Só o que é desta forma passa: um campo torto gravado à mão não pode
 * virar uma porta aberta (permissão em branco) nem uma porta trancada para sempre.
 */
export const artifactAccessOf = (value: unknown): ArtifactAccess | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const restricted = raw.restricted === true;
  const permission = typeof raw.permission === 'string' && raw.permission.trim() ? raw.permission.trim() : null;
  if (!restricted && !permission) return null;
  return { ...(restricted ? { restricted: true } : {}), ...(permission ? { permission } : {}) };
};

export const isRestricted = (access: ArtifactAccess | null | undefined): boolean => access?.restricted === true;

/** A permissão existente escolhida, quando é um id válido. Inválida, não restringe nada nem trava a porta. */
export const chosenPermission = (access: ArtifactAccess | null | undefined): string | null => {
  const permission = access?.permission?.trim();
  return permission && isValidAccessPermissionId(permission) ? permission : null;
};

export interface WorkflowDoor extends AccessArtifact {
  access?: ArtifactAccess | null;
}

/**
 * TUDO o que executar um workflow à mão exige — o botão de uma ação, `runWorkflow`, o MCP.
 *
 * Uma lista só, e não uma checagem em cada porta: foi o que os relatórios aprenderam, com quatro lugares
 * decidindo "é para você?" e a permissão própria em nenhum deles. `automation.run` continua sendo a base:
 * a do fluxo restringe por cima, nunca substitui.
 *
 * Cobrada só na PORTA. Um `call-workflow` dentro de outro fluxo não pergunta de novo: quem montou o fluxo
 * de fora decidiu oferecer o de dentro, e cobrar no meio quebraria a execução pela metade.
 */
export const workflowRunPermissions = (workflow: WorkflowDoor): string[] => {
  const chosen = chosenPermission(workflow.access);
  return [...new Set([
    PERMISSION_AUTOMATION_RUN,
    ...(isRestricted(workflow.access) ? [workflowRunPermissionId(workflow)] : []),
    ...(chosen ? [chosen] : []),
  ])];
};

export interface RestrictedWorkflowSource extends WorkflowDoor {
  name: string;
}

export interface RestrictedReportSource extends AccessArtifact {
  title: string;
  restricted: boolean;
}

/**
 * As portas restritas como RECURSOS do catálogo — um grupo por porta, como uma tela, com o nome dela
 * resolvido na hora de mostrar. Executar o fluxo arrasta `automation.run`: quem marca "Executar:
 * Reajustar salário" não precisa saber que a base existe.
 */
export const artifactPermissionResources = (
  workflows: readonly RestrictedWorkflowSource[],
  reports: readonly RestrictedReportSource[],
): PermissionResource[] => [
  ...workflows.filter((workflow) => isRestricted(workflow.access)).map((workflow) => ({
    id: workflowRunResourceId(workflow),
    name: '@core.access/resource.workflow',
    nameParams: { name: workflow.name },
    derivedActions: [{
      action: WORKFLOW_RUN_ACTION,
      name: '@core.access/action.run',
      description: '@core.access/action.run.description',
      requires: [PERMISSION_AUTOMATION_RUN],
    }],
  })),
  ...reports.filter((report) => report.restricted).map((report) => ({
    id: reportViewResourceId(report),
    name: '@core.access/resource.report',
    nameParams: { name: report.title },
    derivedActions: [{
      action: REPORT_VIEW_ACTION,
      name: '@core.access/action.view',
      description: '@core.access/action.view.description',
    }],
  })),
];
