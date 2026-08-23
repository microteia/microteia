import type { Firestore } from 'firebase-admin/firestore';
import type { Contribution, QualifiedContribution } from '../../domain/schema/plugin/contribution';
import type { PermissionCatalog, PermissionResource } from '../../domain/schema/access';
import {
  ACCESS_PERMISSION_POINT,
  ACCESS_RESOURCE_POINT,
  KERNEL_PERMISSIONS,
  KERNEL_PERMISSION_RESOURCES,
  buildPermissionCatalog,
  declaredPermissionsOf,
  declaredResourcesOf,
} from '../../domain/schema/access';

const DEFAULT_TTL_MS = 5 * 60_000;

interface CacheEntry {
  catalog: PermissionCatalog;
  loadedAt: number;
}

const qualify = (contributes: unknown, pluginId: string): QualifiedContribution[] =>
  Array.isArray(contributes)
    ? (contributes as Contribution[]).map((contribution) => ({ ...contribution, pluginId }))
    : [];

/**
 * O catálogo de permissões do escritório, do lado do servidor.
 *
 * Ele precisa ser o MESMO que o navegador monta, senão a tela ofereceria o que a regra recusa: as
 * três fontes são as mesmas (o núcleo, as telas declaradas e as extensões instaladas e ativas) e a
 * função que as junta é literalmente a mesma — `domain/schema/access` é sincronizado, não reescrito.
 *
 * O núcleo entra por `KERNEL_PERMISSIONS`, e não por um host de plugins: aqui não há UI, e montar um
 * host só para ler doze declarações estáticas seria custo por simetria.
 */
export class PermissionCatalogCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly db: Firestore,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  async get(tenantId: string): Promise<PermissionCatalog> {
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) return cached.catalog;

    const [screenSnapshot, lookupSnapshot, tagSnapshot, extensionSnapshot] = await Promise.all([
      this.db.collection(`tenants/${tenantId}/screenDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/lookupDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/tagDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/installed_extensions`).get(),
    ]);

    const screenResources: PermissionResource[] = screenSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: typeof data.dataCollection === 'string' && data.dataCollection ? data.dataCollection : doc.id,
        name:
          (typeof data.titlePlural === 'string' && data.titlePlural) ||
          (typeof data.titleSingular === 'string' && data.titleSingular) ||
          doc.id,
        deriveCrud: true,
        ...(typeof data.ownerPluginId === 'string' ? { source: data.ownerPluginId } : {}),
      };
    });

    // Lista de opções e conjunto de etiquetas também são coleções, e passam pelo mesmo curinga das
    // regras: sem permissão derivada delas, ninguém acrescentaria uma opção a uma lista.
    const listResources: PermissionResource[] = [...lookupSnapshot.docs, ...tagSnapshot.docs].map((doc) => ({
      id: doc.id,
      name: typeof doc.data().label === 'string' ? (doc.data().label as string) : doc.id,
      deriveCrud: true,
    }));

    const extensionContributions = extensionSnapshot.docs.flatMap((doc) => {
      const data = doc.data();
      if (data.active === false) return [];
      return qualify(data.package?.manifest?.contributes, doc.id);
    });

    const catalog = buildPermissionCatalog(
      [
        ...KERNEL_PERMISSIONS.map((permission) => ({ permission, source: 'core.access' })),
        ...declaredPermissionsOf(
          extensionContributions.filter((c) => c.point === ACCESS_PERMISSION_POINT),
        ),
      ],
      [
        ...KERNEL_PERMISSION_RESOURCES,
        ...declaredResourcesOf(extensionContributions.filter((c) => c.point === ACCESS_RESOURCE_POINT)),
        ...listResources,
        ...screenResources,
      ],
    );

    this.entries.set(tenantId, { catalog, loadedAt: Date.now() });
    return catalog;
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }
}
