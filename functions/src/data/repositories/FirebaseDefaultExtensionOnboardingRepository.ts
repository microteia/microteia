import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IDefaultExtensionOnboardingRepository } from '../../domain/repositories/IDefaultExtensionOnboardingRepository';
import {
  DEFAULT_EXTENSIONS_ONBOARDING_DOC,
  EXTENSION_ONBOARDING_COLLECTION,
  type DefaultCatalogSide,
} from '../../domain/schema/plugin/defaultExtensions';
import type { PluginDependency } from '../../domain/schema/plugin/pluginManifest';
import { REGISTRATION_POLICY_PATH, registrationPolicyOf } from '../../domain/schema/registration';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class FirebaseDefaultExtensionOnboardingRepository implements IDefaultExtensionOnboardingRepository {
  constructor(private readonly db: Firestore) {}

  async readDefaults(): Promise<string[]> {
    const snapshot = await this.db.doc(REGISTRATION_POLICY_PATH).get();
    return registrationPolicyOf(snapshot.exists ? snapshot.data() : undefined).defaultExtensions;
  }

  async readCatalog(ids: readonly string[]): Promise<DefaultCatalogSide[]> {
    if (ids.length === 0) return [];
    const snapshots = await this.db.getAll(...ids.map((id) => this.db.collection('public_extensions').doc(id)));
    return snapshots.flatMap((snapshot): DefaultCatalogSide[] => {
      if (!snapshot.exists) return [];
      const dependencies = snapshot.get('package.manifest.dependencies') as unknown;
      return [{
        id: snapshot.id,
        status: typeof snapshot.get('status') === 'string' ? (snapshot.get('status') as string) : 'pending',
        proven: isRecord(snapshot.get('proof')),
        ...(isRecord(dependencies) ? { dependencies: dependencies as Record<string, PluginDependency> } : {}),
      }];
    });
  }

  async stage(tenantId: string, pending: readonly string[]): Promise<void> {
    await this.db
      .collection('tenants').doc(tenantId)
      .collection(EXTENSION_ONBOARDING_COLLECTION).doc(DEFAULT_EXTENSIONS_ONBOARDING_DOC)
      .set({ pending: [...pending], failed: [], stagedAt: FieldValue.serverTimestamp() });
  }
}
