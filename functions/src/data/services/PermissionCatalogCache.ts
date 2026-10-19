import type { Firestore } from 'firebase-admin/firestore';
import type { Contribution, QualifiedContribution } from '../../domain/schema/plugin/contribution';
import type { PermissionCatalog } from '../../domain/schema/access';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { CatalogScreenSource } from '../../domain/schema/tenantCollections';
import {
  tenantCollectionPermissionResources,
  tenantLookupCollections,
  tenantTagCollections,
} from '../../domain/schema/tenantCollections';
import {
  ACCESS_PERMISSION_POINT,
  ACCESS_REQUIREMENT_POINT,
  ACCESS_RESOURCE_POINT,
  KERNEL_PERMISSIONS,
  KERNEL_PERMISSION_RESOURCES,
  buildPermissionCatalog,
  declaredPermissionsOf,
  declaredRequirementsOf,
  declaredResourcesOf,
} from '../../domain/schema/access';

const DEFAULT_TTL_MS = 5 * 60_000;

interface CacheEntry {
  catalog: PermissionCatalog;
  loadedAt: number;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const screenOf = (id: string, data: Record<string, unknown>): CatalogScreenSource => ({
  id,
  dataCollection: text(data.dataCollection) ?? null,
  origin: data.origin === 'builtin' || data.origin === 'plugin' ? data.origin : 'design',
  titleSingular: text(data.titleSingular) ?? '',
  titlePlural: text(data.titlePlural),
  tagCollection: text(data.tagCollection) ?? null,
  ownerPluginId: text(data.ownerPluginId) ?? null,
  fields: Array.isArray(data.fields) ? (data.fields as FieldDefinition[]) : [],
});

const declarationOf = (id: string, data: Record<string, unknown>) => ({
  collection: id,
  label: text(data.label) ?? id,
});

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

    const screens = screenSnapshot.docs.map((doc) => screenOf(doc.id, doc.data()));
    const lookups = tenantLookupCollections(
      screens,
      lookupSnapshot.docs.map((doc) => declarationOf(doc.id, doc.data())),
    );
    const tagLists = tenantTagCollections(
      screens,
      tagSnapshot.docs.map((doc) => declarationOf(doc.id, doc.data())),
    );

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
        // A MESMA conta do `AuthorizationStore`. Ler só `lookupDefinitions` deixava de fora a lista
        // que um campo de tela referencia e as do núcleo: o seletor as oferecia e a emissão as
        // recusava como desconhecidas — no consentimento de OAuth, o acesso inteiro.
        ...tenantCollectionPermissionResources(screens, lookups, tagLists),
      ],
      // A soma ao fecho tem de entrar aqui TAMBÉM, e não é simetria: o que sai deste catálogo é o
      // campo materializado que as Security Rules leem. Somar só no navegador daria a tela que
      // oferece o que a regra recusa — exatamente a divergência que esta classe existe para evitar.
      declaredRequirementsOf(
        extensionContributions.filter((c) => c.point === ACCESS_REQUIREMENT_POINT),
      ),
    );

    this.entries.set(tenantId, { catalog, loadedAt: Date.now() });
    return catalog;
  }

  /**
   * O catálogo lido AGORA, sem o cache. É o que quem RECUSA precisa: a invalidação dos gatilhos só
   * alcança a instância em que eles rodam, e numa instância qualquer a tela criada há um minuto
   * seguiria desconhecida por até `ttlMs`.
   */
  async fresh(tenantId: string): Promise<PermissionCatalog> {
    this.invalidate(tenantId);
    return this.get(tenantId);
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }
}
