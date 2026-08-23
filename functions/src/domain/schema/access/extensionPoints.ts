// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/extensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution, QualifiedContribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import type { AccessPermission } from './permission';
import { isValidAccessPermissionId } from './permission';
import type { DeclaredPermission, PermissionResource } from './resolvePermissions';

export const ACCESS_PERMISSION_POINT = 'access.permission';
export const ACCESS_RESOURCE_POINT = 'access.resource';

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
