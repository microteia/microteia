import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { flattenSteps } from '../../services/stepTree';
import { HTTP_REQUEST_STEP_ID } from '../../schema/httpRequestSpec';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import {
  DECLARED_CONNECTIONS_SINCE_KERNEL,
  HTTP_CONNECTION_POINT,
  httpConnectionRequirementIssues,
  isHostCovered,
  type HttpConnectionRequirementMetadata,
} from '../../schema/httpConnectionRequirement';

export interface HttpConnectionPackageIssue {
  message: string;
  messageParams: Record<string, string>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** O domínio de uma URL fixa — `null` quando ele vem de marcador e só se sabe na execução. */
const literalHostOf = (url: unknown): string | null => {
  const mapping = url as { kind?: unknown; value?: unknown } | undefined;
  if (mapping?.kind !== 'Literal' || typeof mapping.value !== 'string') return null;
  const match = /^https?:\/\/([^/?#:]+)/i.exec(mapping.value.trim());
  if (!match || match[1].includes('{')) return null;
  return match[1].toLowerCase();
};

/**
 * As credenciais que o pacote declara (`http.connection`) contra as que as automações dele USAM.
 *
 * Cada recusa fecha um defeito que só apareceria no escritório que instalou:
 * - declaração sem forma de credencial: o formulário que ela preenche reprovaria do mesmo jeito;
 * - kernel que admite versão sem o ponto: lá a declaração seria ignorada, e nada seria cobrado;
 * - credencial usada e não declarada (pacote que já mira o ponto): a instalação não a pediria, e a
 *   automação falharia na primeira execução — exatamente o que a declaração existe para evitar;
 * - URL fixa fora dos domínios declarados: o escritório cadastraria a credencial com os domínios da
 *   declaração, e a chamada seria recusada por mandar o segredo para outro lugar.
 *
 * O pacote que NÃO mira o ponto continua passando sem declarar: recusá-lo quebraria quem já publicou
 * antes de a declaração existir.
 */
export const httpConnectionPackageIssues = (pkg: MarketplacePlugin): HttpConnectionPackageIssue[] => {
  const issues: HttpConnectionPackageIssue[] = [];
  const kernel = pkg.manifest?.kernel ?? '';
  const targetsPoint = rangeExcludesBelow(kernel, DECLARED_CONNECTIONS_SINCE_KERNEL);
  const declarations = (pkg.manifest?.contributes ?? []).filter((one) => one?.point === HTTP_CONNECTION_POINT);

  if (declarations.length > 0 && !targetsPoint) {
    issues.push({ message: '@core.marketplace/issue.http-connection.kernel', messageParams: { minimum: DECLARED_CONNECTIONS_SINCE_KERNEL } });
  }

  const declared = new Map<string, HttpConnectionRequirementMetadata>();
  for (const contribution of declarations) {
    const metadata = (contribution.metadata ?? {}) as unknown as HttpConnectionRequirementMetadata;
    const key = text(metadata.key);
    const params = { connection: key || contribution.id };
    if (declared.has(key)) {
      issues.push({ message: '@core.marketplace/issue.http-connection.duplicate', messageParams: params });
      continue;
    }
    const shapeIssues = httpConnectionRequirementIssues({
      ...metadata,
      hosts: Array.isArray(metadata.hosts) ? metadata.hosts : [],
    });
    for (const issue of shapeIssues) {
      issues.push({
        message: '@core.marketplace/issue.http-connection.invalid',
        messageParams: { ...params, ...(issue.errorParams ?? {}), detail: issue.error },
      });
    }
    if (shapeIssues.length === 0) declared.set(key, metadata);
  }

  for (const workflow of pkg.workflows ?? []) {
    for (const step of flattenSteps(workflow.steps ?? [])) {
      if (step.stepDefinitionId !== HTTP_REQUEST_STEP_ID) continue;
      const request = step.configuration?.request;
      if (request?.kind !== 'Literal') continue;
      const spec = request.value as { connection?: unknown; url?: unknown } | null;
      const key = text(spec?.connection);
      if (key === '') continue;
      const params = { workflow: workflow.templateId, step: step.id, connection: key };
      const declaration = declared.get(key);
      if (!declaration) {
        if (targetsPoint) issues.push({ message: '@core.marketplace/issue.http-connection.undeclared', messageParams: params });
        continue;
      }
      const host = literalHostOf(spec?.url);
      if (host !== null && !isHostCovered(host, declaration.hosts)) {
        issues.push({ message: '@core.marketplace/issue.http-connection.host', messageParams: { ...params, host } });
      }
    }
  }
  return issues;
};
