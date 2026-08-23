// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/extensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution, QualifiedContribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import type { AccessPermission, AccessRequirement } from './permission';
import { isValidAccessPermissionId } from './permission';
import type {
  DeclaredPermission,
  DeclaredRequirement,
  PermissionResource,
} from './resolvePermissions';

export const ACCESS_PERMISSION_POINT = 'access.permission';
export const ACCESS_RESOURCE_POINT = 'access.resource';
export const ACCESS_REQUIREMENT_POINT = 'access.requirement';

export const ACCESS_API_VERSION = '1.0.0';

/**
 * O ponto pelo qual o produto inteiro declara o que se pode fazer nele.
 *
 * `allowedImplKinds: []` é a decisão que o torna universal: uma permissão é METADATA PURA, sem
 * código para revisar, então qualquer pacote pode declará-la — inclusive um que só traz declaração.
 * É o mesmo raciocínio de `i18n.messages`, e pelo mesmo motivo: o que não executa não precisa de
 * gesto de confiança.
 *
 * `multiple: true` porque o catálogo é a UNIÃO de todos: o núcleo declara as capacidades dele, cada
 * extensão declara as suas, e nenhum dos dois precisa conhecer as Roles do escritório.
 */
export const ACCESS_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: ACCESS_PERMISSION_POINT,
    apiVersion: ACCESS_API_VERSION,
    title: '@core.access/point.permission.title',
    description: '@core.access/point.permission.description',
    ownerPluginId: 'core.access',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: ACCESS_RESOURCE_POINT,
    apiVersion: ACCESS_API_VERSION,
    title: '@core.access/point.resource.title',
    description: '@core.access/point.resource.description',
    ownerPluginId: 'core.access',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  /**
   * O ponto pelo qual um pacote soma ao fecho de uma permissão que não é dele.
   *
   * `multiple: true` é o que ele existe para resolver: `access.permission` recusa o mesmo id duas
   * vezes — e deve recusar, porque quem declara também dá nome —, e por isso duas extensões que
   * complementam a mesma tela não tinham como dizer, as duas, de que ler aquela tela passou a
   * depender. Aqui a soma não tem nome, não substitui nada e o fecho é a união.
   */
  {
    id: ACCESS_REQUIREMENT_POINT,
    apiVersion: ACCESS_API_VERSION,
    title: '@core.access/point.requirement.title',
    description: '@core.access/point.requirement.description',
    ownerPluginId: 'core.access',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

const contributionId = (id: string): string => id.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();

export const accessPermissionContribution = (
  permission: AccessPermission,
  priority?: number,
): Contribution => ({
  point: ACCESS_PERMISSION_POINT,
  id: contributionId(permission.id),
  apiVersion: ACCESS_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: permission as unknown as Record<string, unknown>,
});

/** Lê de volta a permissão de uma contribuição, descartando metadata malformada de terceiro. */
export const accessPermissionOf = (contribution: Contribution): AccessPermission | null => {
  const metadata = contribution?.metadata as Partial<AccessPermission> | undefined;
  if (!metadata || !isValidAccessPermissionId(metadata.id ?? '')) return null;
  return metadata as AccessPermission;
};

/**
 * As permissões declaradas, com a ORIGEM de cada uma. A origem não é campo da permissão: é o
 * `pluginId` de quem contribuiu, e vem de graça do registro — declará-la de novo abriria a porta
 * para um pacote se dizer outro.
 */
export const declaredPermissionsOf = (
  contributions: QualifiedContribution[],
): DeclaredPermission[] => {
  const declared: DeclaredPermission[] = [];
  for (const contribution of contributions) {
    const permission = accessPermissionOf(contribution);
    if (permission) declared.push({ permission, source: contribution.pluginId });
  }
  return declared;
};

/**
 * O RÓTULO de um recurso que não é coleção de tela — `roles`, `automation`, `audit`. A coleção traz
 * o próprio nome (o título da tela) e não precisa disto; o que não é coleção precisaria aparecer na
 * tela de Roles como o identificador cru, e é isso que este ponto evita.
 */
export const accessResourceContribution = (
  resource: { id: string; name: string },
  priority?: number,
): Contribution => ({
  point: ACCESS_RESOURCE_POINT,
  id: contributionId(resource.id),
  apiVersion: ACCESS_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: { ...resource },
});

/**
 * A soma ao fecho de uma permissão alheia. O `id` da contribuição sai da permissão ALVO, então um
 * mesmo pacote não soma duas vezes à mesma permissão — se ele precisa de duas dependências, elas
 * cabem na mesma lista. Dois pacotes diferentes somando à mesma permissão não colidem: a checagem de
 * contribuição duplicada é por pacote, e o ponto é `multiple`.
 */
export const accessRequirementContribution = (
  requirement: AccessRequirement,
  priority?: number,
): Contribution => ({
  point: ACCESS_REQUIREMENT_POINT,
  id: contributionId(requirement.id),
  apiVersion: ACCESS_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: requirement as unknown as Record<string, unknown>,
});

/** As somas declaradas, com a origem de cada uma — mesmo desenho de `declaredPermissionsOf`. */
export const declaredRequirementsOf = (
  contributions: QualifiedContribution[],
): DeclaredRequirement[] => {
  const declared: DeclaredRequirement[] = [];
  for (const contribution of contributions) {
    const metadata = contribution?.metadata as Partial<AccessRequirement> | undefined;
    if (!metadata || !isValidAccessPermissionId(metadata.id ?? '')) continue;
    if (!Array.isArray(metadata.requires)) continue;
    declared.push({
      requirement: { id: metadata.id as string, requires: metadata.requires },
      source: contribution.pluginId,
    });
  }
  return declared;
};

const RESOURCE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export const declaredResourcesOf = (
  contributions: QualifiedContribution[],
): PermissionResource[] => {
  const resources: PermissionResource[] = [];
  for (const contribution of contributions) {
    const metadata = contribution?.metadata as { id?: unknown; name?: unknown } | undefined;
    const id = metadata?.id;
    const name = metadata?.name;
    if (typeof id !== 'string' || !RESOURCE_ID_PATTERN.test(id)) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    resources.push({ id, name, source: contribution.pluginId });
  }
  return resources;
};
