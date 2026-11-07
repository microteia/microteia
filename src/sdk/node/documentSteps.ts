import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { WorkflowStep } from '../../domain/entities/Workflow';
import { flattenSteps } from '../../domain/services/stepTree';
import type { DocumentTemplateContract } from '../../domain/usecases/plugins/documentStepIntegrity';
import {
  declaredDocumentTemplates,
  renderDocumentStepIssues,
  renderDocumentTemplateKey,
} from '../../domain/usecases/plugins/documentStepIntegrity';
import { INSTALLED_CATALOG_FILE, refreshInstalledCatalog } from './installedCatalog';
import { describeMessage, packageText } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * O passo `render-document` que cita um modelo de OUTRO pacote, conferido contra o que este diretório
 * enxerga.
 *
 * O modelo do próprio pacote a porta única já confere (`workflowIntegrity.ts`), e recusa. O de outro
 * pacote não está em mãos lá — e é justamente o caso que mais cresce: um modelo `payload` existe para
 * ser gerado de vários pacotes, e cada um cita a mesma chave e os mesmos nomes de parâmetro. Aqui há
 * duas fontes, na precedência de sempre: os `plugin.ts` deste diretório e o retrato da instalação.
 *
 * - `ok`: o modelo foi achado, e o passo cumpre o contrato dele.
 * - `refused`: o modelo foi achado, e o passo não o cumpre — o motor recusaria, ou descartaria um
 *   valor em silêncio, onde quer que esse modelo responda pela chave.
 * - `unverifiable`: ninguém visível declara a chave. Nunca recusa: o modelo pode ser do escritório
 *   (que não viaja no retrato), ou de uma extensão escrita em outro lugar.
 */
export type DocumentStepStatus = 'ok' | 'refused' | 'unverifiable';

export interface DocumentStepFinding {
  templateKey: string;
  step: string;
  /** Que automação do pacote tem o passo, resolvida para texto. */
  writtenBy: string;
  status: DocumentStepStatus;
  detail: string;
}

export interface PendingDocumentStep {
  workflow: string;
  step: WorkflowStep;
  templateKey: string;
}

interface VisibleTemplate {
  template: DocumentTemplateContract;
  owner: string;
  where: string;
}

/** Os passos que citam, por `Literal`, um modelo que o próprio pacote não declara. */
export const pendingDocumentSteps = (pkg: MarketplacePlugin): PendingDocumentStep[] => {
  const own = new Set(declaredDocumentTemplates(pkg.manifest?.contributes).map((template) => template.key));
  return (pkg.workflows ?? []).flatMap((workflow) =>
    flattenSteps(workflow.steps).flatMap((step) => {
      const templateKey = renderDocumentTemplateKey(step);
      return templateKey === null || own.has(templateKey) ? [] : [{ workflow: workflow.name, step, templateKey }];
    }));
};

/** Workspace primeiro: é o pacote em edição, e é dele que sairá a próxima versão instalada. */
const visibleTemplates = (pkg: MarketplacePlugin, read: WorkspaceCatalog): Map<string, VisibleTemplate> => {
  const found = new Map<string, VisibleTemplate>();
  const add = (template: DocumentTemplateContract, owner: string, where: string): void => {
    if (!found.has(template.key)) found.set(template.key, { template, owner, where });
  };

  const authoredHere = new Set(read.authored.map((one) => one.pluginId));
  for (const one of read.authored) {
    if (one.pluginId === pkg.manifest.id) continue;
    for (const template of one.documentTemplates ?? []) add(template, one.pluginId, `the plugin.ts of ${one.pluginId} in this workspace`);
  }

  const snapshot = read.installed;
  for (const one of snapshot?.extensions ?? []) {
    if (one.id === pkg.manifest.id || authoredHere.has(one.id)) continue;
    for (const template of one.documentTemplates ?? []) {
      add(template, one.id, `${INSTALLED_CATALOG_FILE}, taken ${snapshot?.ageDays ?? '?'} day(s) ago`);
    }
  }
  return found;
};

export const documentStepFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): DocumentStepFinding[] => {
  const templates = visibleTemplates(pkg, read);
  const snapshot = read.installed;
  const describe = packageText(pkg);
  const silent = (snapshot?.extensions ?? []).filter((one) => one.documentTemplates === undefined).map((one) => one.id);

  return pendingDocumentSteps(pkg).map(({ workflow, step, templateKey }): DocumentStepFinding => {
    const head = {
      templateKey,
      step: step.id,
      writtenBy: `${describeMessage('@core.marketplace/ref.origin.workflow')} "${describe(workflow)}"`,
    };

    const visible = templates.get(templateKey);
    if (visible !== undefined) {
      const ref = { kind: 'workflow' as const, id: step.id, from: { origin: '@core.marketplace/ref.origin.workflow', name: workflow } };
      const issues = renderDocumentStepIssues(step, visible.template, ref);
      if (issues.length === 0) {
        return {
          ...head,
          status: 'ok',
          detail: `${visible.owner} declares it, according to ${visible.where}, and the step fills its contract.`,
        };
      }
      return {
        ...head,
        status: 'refused',
        detail: `${visible.owner} declares it, according to ${visible.where}: `
          + issues.map((issue) => describeMessage(issue.message, issue.messageParams)).join(' '),
      };
    }

    const older = silent.length === 0
      ? ''
      : ` ${INSTALLED_CATALOG_FILE} does not record the templates of ${silent.join(', ')} — it was taken by a `
        + `Console older than that field. ${refreshInstalledCatalog(snapshot?.tenantId ?? '<tenantId>')}.`;
    return {
      ...head,
      status: 'unverifiable',
      detail: 'no other plugin.ts in this workspace and no extension in '
        + `${snapshot === null ? `an ${INSTALLED_CATALOG_FILE} (there is none here)` : INSTALLED_CATALOG_FILE} `
        + 'declares this template, so the step cannot be checked against it. It may be the organization\'s own '
        + 'template, which no snapshot carries; if the key is a typo, the step fails when it runs '
        + `("render.template-not-found").${older}`,
    };
  });
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando há passo pendente: conferir um pacote
 * que só gera os próprios modelos não paga o preço de compilar todos os `plugin.ts` do diretório.
 */
export const documentStepReport = (pkg: MarketplacePlugin, root: string): DocumentStepFinding[] =>
  pendingDocumentSteps(pkg).length === 0 ? [] : documentStepFindings(pkg, readWorkspaceCatalog(root));
