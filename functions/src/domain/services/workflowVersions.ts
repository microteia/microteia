import { contentOriginOf, sameInstallation, sameWorkflowContent, workflowVersionContent } from '../schema/workflowVersion';
import type { WorkflowContentOrigin, WorkflowVersionContent } from '../schema/workflowVersion';

export interface StoredVersionHead {
  version: number;
  origin: WorkflowContentOrigin | null;
}

export interface WorkflowVersionDeps {
  /** Grava a versão se ela ainda não existe — uma versão é imutável, e um reenvio do gatilho não a reescreve. */
  saveVersionIfAbsent(
    tenantId: string, definitionId: string, version: number, content: WorkflowVersionContent, origin: WorkflowContentOrigin,
  ): Promise<void>;
  /** Completa a versão com a segunda passada da MESMA instalação. */
  replaceVersion(
    tenantId: string, definitionId: string, version: number, content: WorkflowVersionContent, origin: WorkflowContentOrigin,
  ): Promise<void>;
  /** A versão guardada de número mais alto — inclusive de uma automação apagada e recriada com o mesmo id. */
  latestVersion(tenantId: string, definitionId: string): Promise<StoredVersionHead | null>;
  /** Escreve SÓ o número da versão na definição — o que não muda o conteúdo e não gera versão nova. */
  setDefinitionVersion(tenantId: string, definitionId: string, version: number): Promise<void>;
}

type Stored = Record<string, unknown> | null | undefined;

const versionOf = (definition: Stored): number => {
  const value = definition?.version;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
};

/**
 * Numera a automação a cada mudança de CONTEÚDO e guarda cada versão, com a ORIGEM dela — o número é do
 * SERVIDOR.
 *
 * Do servidor porque o cliente grava sem saber quantas vezes ela já mudou, e a instalação de uma extensão
 * grava `version: 1` de novo. O número segue a MAIOR versão guardada: uma automação apagada (a
 * desinstalação) e recriada com o mesmo id (a reinstalação) continua a numeração em vez de colidir com a
 * versão 1 de antes — que, imutável, ficaria mostrando o conteúdo velho.
 *
 * A atualização de uma extensão grava em DUAS passadas (o conteúdo, depois o remapeamento dos ids de
 * `call-workflow`). A segunda, da mesma instalação, COMPLETA a versão que a primeira criou: a
 * intermediária, com referências ainda no id do pacote, não é uma versão que alguém deva restaurar.
 *
 * Antes da primeira versão nova, a de antes também é guardada, se ainda não estava — é ela que uma
 * execução parada desde antes do versionamento precisa achar para retomar como começou.
 *
 * A gravação do número dispara este gatilho de novo, e é o conteúdo igual que o encerra ali.
 */
export const versionWorkflowOnWrite = async (
  tenantId: string,
  definitionId: string,
  before: Stored,
  after: Stored,
  deps: WorkflowVersionDeps,
): Promise<number | null> => {
  if (!after) return null;
  if (before && sameWorkflowContent(before, after)) return null;

  const origin = contentOriginOf(after.contentOrigin);
  const content = workflowVersionContent(after);
  const latest = await deps.latestVersion(tenantId, definitionId);
  const current = versionOf(before);

  if (before && latest && latest.version === current && sameInstallation(latest.origin, origin)) {
    await deps.replaceVersion(tenantId, definitionId, latest.version, content, origin);
    if (versionOf(after) !== latest.version) await deps.setDefinitionVersion(tenantId, definitionId, latest.version);
    return latest.version;
  }

  if (before && current > 0) {
    await deps.saveVersionIfAbsent(
      tenantId, definitionId, current, workflowVersionContent(before), contentOriginOf(before.contentOrigin),
    );
  }
  const next = Math.max(current, latest?.version ?? 0) + 1;
  await deps.saveVersionIfAbsent(tenantId, definitionId, next, content, origin);
  if (versionOf(after) !== next) await deps.setDefinitionVersion(tenantId, definitionId, next);
  return next;
};
