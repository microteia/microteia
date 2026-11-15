import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
  CatalogEntry,
  IExtensionPublicationRepository,
  PublicationReading,
  PublicationWrite,
} from '../../domain/repositories/IExtensionPublicationRepository';
import type {
  CatalogSide,
  InstalledCopySide,
  PublicationProof,
} from '../../domain/schema/plugin/publicationProof';
import type { AppliedBackendFingerprint } from '../../domain/schema/plugin/backendRequirement';
import type { PluginDependency } from '../../domain/schema/plugin/pluginManifest';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const installedCopyFrom = (data: DocumentData): InstalledCopySide => ({
  active: data.active !== false,
  source: typeof data.source === 'string' ? data.source : 'public',
  package: data.package as InstalledCopySide['package'],
  codeTrust: isRecord(data.codeTrust) ? data.codeTrust : null,
  backendState: isRecord(data.backendState) ? data.backendState : null,
});

const proofFrom = (value: unknown): PublicationProof | null => {
  if (!isRecord(value) || typeof value.tenantId !== 'string') return null;
  const at = value.provenAt;
  return {
    tenantId: value.tenantId,
    version: typeof value.version === 'string' ? value.version : '',
    revision: typeof value.revision === 'string' ? value.revision : '',
    provenBy: typeof value.provenBy === 'string' ? value.provenBy : '',
    provenAt: at instanceof Timestamp ? at.toDate() : new Date(0),
  };
};

const appliedBackendFrom = (data: DocumentData | undefined): AppliedBackendFingerprint[] =>
  (Array.isArray(data?.extensions) ? data.extensions : []).flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.pluginId === 'string' && typeof entry.fingerprint === 'string'
      ? [{ pluginId: entry.pluginId, fingerprint: entry.fingerprint }]
      : []);

const appliedMigrationIdsFrom = (data: DocumentData | undefined): Set<string> =>
  new Set((Array.isArray(data?.applied) ? data.applied : []).flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []));

export class FirebaseExtensionPublicationRepository implements IExtensionPublicationRepository {
  constructor(private readonly db: Firestore) {}

  async read(tenantId: string, pluginId: string): Promise<PublicationReading> {
    const tenant = this.db.collection('tenants').doc(tenantId);
    // Os pacotes podem ter centenas de KB cada: das outras instaladas e do catálogo só se lê o que a
    // régua usa. A cópia desta extensão é a única lida inteira — é ela que vai ao catálogo.
    const [installed, siblings, migrations, applied, catalog] = await Promise.all([
      tenant.collection('installed_extensions').doc(pluginId).get(),
      tenant.collection('installed_extensions').select('source').get(),
      tenant.collection('extension_migrations').doc(pluginId).get(),
      this.db.collection('backend_state').doc('applied').get(),
      this.db.collection('public_extensions').select('version', 'status', 'package.manifest.dependencies').get(),
    ]);

    return {
      installed: installed.exists ? installedCopyFrom(installed.data() ?? {}) : null,
      siblings: new Map(siblings.docs
        .filter((doc) => doc.id !== pluginId)
        .map((doc) => [doc.id, { source: typeof doc.get('source') === 'string' ? (doc.get('source') as string) : 'public' }])),
      appliedMigrationIds: appliedMigrationIdsFrom(migrations.data()),
      projectBackend: appliedBackendFrom(applied.data()),
      catalog: catalog.docs
        .filter((doc) => doc.id !== pluginId)
        .map((doc): CatalogSide => {
          const dependencies = doc.get('package.manifest.dependencies') as unknown;
          return {
            id: doc.id,
            version: typeof doc.get('version') === 'string' ? (doc.get('version') as string) : '0.0.0',
            status: typeof doc.get('status') === 'string' ? (doc.get('status') as string) : 'pending',
            ...(isRecord(dependencies) ? { dependencies: dependencies as Record<string, PluginDependency> } : {}),
          };
        }),
    };
  }

  async commit(pluginId: string, decide: (current: CatalogEntry | null) => PublicationWrite): Promise<PublicationWrite> {
    const ref = this.db.collection('public_extensions').doc(pluginId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      const current: CatalogEntry | null = snapshot.exists && data
        ? {
          ownerTenantId: typeof data.ownerTenantId === 'string' ? data.ownerTenantId : '',
          version: typeof data.version === 'string' ? data.version : '0.0.0',
          status: typeof data.status === 'string' ? data.status : 'pending',
          package: data.package,
          proof: proofFrom(data.proof),
        }
        : null;

      const write = decide(current);
      const proof = write.kind === 'publish' ? write.entry.proof : write.proof;
      const storedProof = { ...proof, provenAt: Timestamp.fromDate(proof.provenAt) };

      if (write.kind === 'prove') {
        transaction.update(ref, { proof: storedProof });
      } else {
        const { entry } = write;
        transaction.set(ref, {
          package: entry.package,
          ownerTenantId: entry.ownerTenantId,
          ownerName: entry.ownerName,
          ownerPhotoURL: entry.ownerPhotoURL,
          version: entry.version,
          // Publicar é gesto de quem já poderia aprovar (com código, só o SYSTEM chega aqui).
          status: 'approved',
          hasCode: entry.hasCode,
          publishedBy: entry.publishedBy,
          publishedAt: FieldValue.serverTimestamp(),
          proof: storedProof,
        });
      }
      return write;
    });
  }
}
