import { AggregateField, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IExtensionStatsRepository } from '../../domain/repositories/IExtensionStatsRepository';
import { countsAsCatalogInstall } from '../../domain/services/extensionStats';

const SEED_READ_CHUNK = 200;
const SEED_WRITE_CHUNK = 400;

export class FirebaseExtensionStatsRepository implements IExtensionStatsRepository {
  constructor(private readonly db: Firestore) {}

  private stats(pluginId: string) {
    return this.db.collection('extension_stats').doc(pluginId);
  }

  async setInstallMarker(pluginId: string, tenantId: string, installed: boolean): Promise<void> {
    const marker = this.stats(pluginId).collection('installs').doc(tenantId);
    if (installed) await marker.set({ at: FieldValue.serverTimestamp() });
    else await marker.delete();
  }

  async isInstallCountSeeded(pluginId: string): Promise<boolean> {
    const snapshot = await this.stats(pluginId).get();
    return snapshot.get('installsSeeded') === true;
  }

  async findCatalogInstallTenants(pluginId: string): Promise<string[]> {
    const tenants = await this.db.collection('tenants').listDocuments();
    const found: string[] = [];
    for (let start = 0; start < tenants.length; start += SEED_READ_CHUNK) {
      const refs = tenants
        .slice(start, start + SEED_READ_CHUNK)
        .map((tenant) => tenant.collection('installed_extensions').doc(pluginId));
      if (refs.length === 0) continue;
      const snapshots = await this.db.getAll(...refs);
      for (const snapshot of snapshots) {
        if (snapshot.exists && countsAsCatalogInstall(snapshot.data())) {
          const tenantId = snapshot.ref.parent.parent?.id;
          if (tenantId) found.push(tenantId);
        }
      }
    }
    return found;
  }

  async seedInstallMarkers(pluginId: string, tenantIds: string[]): Promise<void> {
    const installs = this.stats(pluginId).collection('installs');
    for (let start = 0; start < tenantIds.length; start += SEED_WRITE_CHUNK) {
      const batch = this.db.batch();
      for (const tenantId of tenantIds.slice(start, start + SEED_WRITE_CHUNK)) {
        batch.set(installs.doc(tenantId), { at: FieldValue.serverTimestamp() });
      }
      await batch.commit();
    }
    await this.stats(pluginId).set({ installsSeeded: true }, { merge: true });
  }

  async countInstallMarkers(pluginId: string): Promise<number> {
    const snapshot = await this.stats(pluginId).collection('installs').count().get();
    return snapshot.data().count;
  }

  async writeInstallCount(pluginId: string, installs: number): Promise<void> {
    await this.stats(pluginId).set({ installs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  async aggregateRatings(pluginId: string): Promise<{ count: number; sum: number }> {
    const snapshot = await this.stats(pluginId)
      .collection('ratings')
      .aggregate({ count: AggregateField.count(), sum: AggregateField.sum('stars') })
      .get();
    const data = snapshot.data();
    return { count: data.count, sum: data.sum ?? 0 };
  }

  async writeRatings(pluginId: string, count: number, sum: number): Promise<void> {
    await this.stats(pluginId).set(
      { ratingCount: count, ratingSum: sum, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}
