import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import type { Contribution } from './plugin/contribution';
import {
  HTTP_AUTH_SCHEMES,
  isHttpConnectionKey,
  validateHttpConnection,
  type HttpAuthScheme,
  type HttpConnection,
  type HttpConnectionIssue,
} from './httpConnection';
import { isHttpHostAllowed } from './httpRequestSpec';

/**
 * A credencial de integração que uma EXTENSÃO precisa que o escritório cadastre.
 *
 * A automação do pacote já nomeava a credencial pela chave (`request.connection: 'crm'`), e só. O
 * escritório que instalava descobria que faltava a credencial na primeira execução, pela mensagem de
 * erro. A declaração diz ANTES o que a extensão espera — a chave, o esquema e os domínios —, e a tela
 * de Extensões cobra o que falta como pendência.
 *
 * Declarar não cria nada: o segredo e a decisão de confiar naqueles domínios são do escritório. A
 * declaração preenche o formulário; quem cadastra revisa e digita o segredo.
 *
 * A chave é do ESCRITÓRIO, não da extensão: duas extensões que declaram `crm` usam a mesma credencial,
 * porque a automação a nomeia sem prefixo desde que a credencial existe.
 */
export const HTTP_CONNECTION_POINT = 'http.connection';
export const HTTP_CONNECTION_POINT_API_VERSION = '1.0.0';

/** O kernel a partir do qual o pacote DECLARA as credenciais de que precisa. */
export const DECLARED_CONNECTIONS_SINCE_KERNEL = '2.123.0';

export const HTTP_CONNECTION_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: HTTP_CONNECTION_POINT,
    apiVersion: HTTP_CONNECTION_POINT_API_VERSION,
    title: '@core.automation/point.http-connection.title',
    description: '@core.automation/point.http-connection.description',
    ownerPluginId: 'core.automation',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/**
 * O que a extensão declara. O usuário do `basic` fica de fora: é do escritório, como o segredo — a
 * extensão sabe que a API pede usuário e senha, não qual usuário cada escritório tem lá.
 */
export interface HttpConnectionRequirementMetadata {
  key: string;
  /** Referência `@<pacote>/<chave>` — o nome que a credencial ganha no formulário. */
  name: string;
  /** Referência — onde se obtém o segredo, para quem vai cadastrar. */
  description?: string;
  scheme: HttpAuthScheme;
  /** O cabeçalho (`header`) ou o parâmetro de query (`query`) que leva o segredo. */
  paramName?: string;
  hosts: string[];
}

export interface HttpConnectionRequirement extends HttpConnectionRequirementMetadata {
  pluginId: string;
}

export const httpConnectionRequirementContribution = (metadata: HttpConnectionRequirementMetadata): Contribution => ({
  point: HTTP_CONNECTION_POINT,
  id: `http-connection.${metadata.key}`,
  apiVersion: HTTP_CONNECTION_POINT_API_VERSION,
  metadata: { ...metadata },
});

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A declaração lida com desconfiança: o que não tem forma de credencial fica de fora. */
export const asHttpConnectionRequirement = (pluginId: string, metadata: unknown): HttpConnectionRequirement | null => {
  const data = (metadata ?? {}) as Record<string, unknown>;
  const key = text(data.key);
  const scheme = text(data.scheme) as HttpAuthScheme;
  if (!isHttpConnectionKey(key) || !(HTTP_AUTH_SCHEMES as readonly string[]).includes(scheme)) return null;
  const hosts = Array.isArray(data.hosts)
    ? data.hosts.map((host) => text(host).toLowerCase()).filter((host) => host !== '')
    : [];
  if (hosts.length === 0) return null;
  return {
    pluginId,
    key,
    name: text(data.name) || key,
    ...(text(data.description) ? { description: text(data.description) } : {}),
    scheme,
    ...(text(data.paramName) ? { paramName: text(data.paramName) } : {}),
    hosts,
  };
};

/** As credenciais que um pacote declara. */
export const httpConnectionRequirementsOf = (
  pluginId: string,
  contributions: readonly Contribution[] | undefined,
): HttpConnectionRequirement[] =>
  (contributions ?? []).flatMap((contribution) => {
    if (contribution?.point !== HTTP_CONNECTION_POINT) return [];
    const requirement = asHttpConnectionRequirement(pluginId, contribution.metadata);
    return requirement ? [requirement] : [];
  });

/**
 * A declaração tem forma de credencial? A MESMA conferência do formulário, menos o usuário do `basic`,
 * que a declaração não traz de propósito.
 */
export const httpConnectionRequirementIssues = (metadata: HttpConnectionRequirementMetadata): HttpConnectionIssue[] =>
  validateHttpConnection({
    key: metadata.key,
    name: metadata.name,
    scheme: metadata.scheme,
    paramName: metadata.paramName,
    hosts: metadata.hosts,
  }).filter((issue) => issue.field !== 'username');

/**
 * O estado de uma credencial declarada no escritório, na ordem do que impede a chamada:
 * - `missing`: não há credencial com a chave;
 * - `scheme`: há, mas autentica de outro jeito — o segredo iria no lugar errado;
 * - `hosts`: os domínios dela não cobrem os declarados — a chamada seria recusada antes de sair;
 * - `no-secret`: falta o segredo;
 * - `office-hosts`: a lista de domínios do escritório não libera algum dos declarados;
 * - `ok`.
 */
export type HttpConnectionRequirementState = 'missing' | 'scheme' | 'hosts' | 'no-secret' | 'office-hosts' | 'ok';

/**
 * Um domínio declarado está coberto pela lista? O curinga declarado (`*.crm.com`) só é coberto por um
 * curinga que o contenha: um domínio fixo da lista libera um endereço, não todos os do curinga.
 */
export const isHostCovered = (declared: string, allowed: readonly string[]): boolean => {
  const host = declared.trim().toLowerCase();
  if (!host.startsWith('*.')) return isHttpHostAllowed(host, allowed);
  return allowed.some((raw) => {
    const pattern = String(raw).trim().toLowerCase();
    return pattern === host || (pattern.startsWith('*.') && host.slice(1).endsWith(pattern.slice(1)));
  });
};

const sameParam = (scheme: HttpAuthScheme, declared: string | undefined, stored: string | undefined): boolean => {
  if (scheme === 'header') return (declared ?? '').toLowerCase() === (stored ?? '').toLowerCase();
  if (scheme === 'query') return (declared ?? '') === (stored ?? '');
  return true;
};

export const httpConnectionRequirementState = (
  requirement: HttpConnectionRequirement,
  connections: readonly HttpConnection[],
  officeHosts: readonly string[],
): HttpConnectionRequirementState => {
  const connection = connections.find((one) => one.key === requirement.key);
  if (!connection) return 'missing';
  if (connection.scheme !== requirement.scheme || !sameParam(requirement.scheme, requirement.paramName, connection.paramName)) {
    return 'scheme';
  }
  if (!requirement.hosts.every((host) => isHostCovered(host, connection.hosts))) return 'hosts';
  if (!connection.hasSecret) return 'no-secret';
  if (!requirement.hosts.every((host) => isHostCovered(host, officeHosts))) return 'office-hosts';
  return 'ok';
};

export interface HttpConnectionRequirementStatus {
  requirement: HttpConnectionRequirement;
  state: HttpConnectionRequirementState;
}

/** O estado de cada credencial que uma extensão instalada declara. */
export const httpConnectionStatusesOf = (
  pluginId: string,
  contributions: readonly Contribution[] | undefined,
  connections: readonly HttpConnection[],
  officeHosts: readonly string[],
): HttpConnectionRequirementStatus[] =>
  httpConnectionRequirementsOf(pluginId, contributions).map((requirement) => ({
    requirement,
    state: httpConnectionRequirementState(requirement, connections, officeHosts),
  }));

/** A lista de domínios do escritório, lida com desconfiança — o valor gravado é dado. */
export const officeHostsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((host): host is string => typeof host === 'string') : [];
