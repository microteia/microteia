import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  IScreenSeedRepository,
  SeedInstalledExtension,
  SeedInstalledScreen,
} from '../../domain/repositories/IScreenSeedRepository';
import {
  EXTENSION_SEEDS_COLLECTION,
  readExtensionSeedState,
} from '../../domain/schema/screenSeed';
import type { ExtensionSeedState, ScreenSeedEntry, ScreenSeedFailure } from '../../domain/schema/screenSeed';

export class FirebaseScreenSeedRepository implements IScreenSeedRepository {
  constructor(private readonly db: Firestore) {}

  private ledger(tenantId: string, pluginId: string) {
    return this.db.collection(`tenants/${tenantId}/${EXTENSION_SEEDS_COLLECTION}`).doc(pluginId);
  }

  async readInstalled(tenantId: string, pluginId: string): Promise<SeedInstalledExtension | null> {
    const snapshot = await this.db.doc(`tenants/${tenantId}/installed_extensions/${pluginId}`).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    return { package: data.package, active: data.active !== false };
  }

  async installedScreens(tenantId: string): Promise<SeedInstalledScreen[]> {
    const snapshot = await this.db.collection(`tenants/${tenantId}/screenDefinitions`).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const dataCollection = typeof data.dataCollection === 'string' ? data.dataCollection.trim() : '';
      return {
        sourceId: typeof data.sourceId === 'string' && data.sourceId ? data.sourceId : doc.id,
        collection: dataCollection || doc.id,
      };
    });
  }

  async isCollectionEmpty(tenantId: string, collection: string): Promise<boolean> {
    const snapshot = await this.db.collection(`tenants/${tenantId}/${collection}`).limit(1).get();
    return snapshot.empty;
  }

  async readState(tenantId: string, pluginId: string): Promise<ExtensionSeedState> {
    const snapshot = await this.ledger(tenantId, pluginId).get();
    return readExtensionSeedState(snapshot.data());
  }

  async claim(tenantId: string, pluginId: string, now: number, leaseMs: number): Promise<ExtensionSeedState | null> {
    const ref = this.ledger(tenantId, pluginId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const state = readExtensionSeedState(snapshot.data());
      if (state.leaseUntil !== null && state.leaseUntil > now) return null;
      tx.set(ref, { pluginId, leaseUntil: now + leaseMs, updatedAt: new Date(now) }, { merge: true });
      return { ...state, leaseUntil: now + leaseMs };
    });
  }

  async release(tenantId: string, pluginId: string): Promise<void> {
    await this.ledger(tenantId, pluginId).set({ leaseUntil: null, updatedAt: new Date() }, { merge: true });
  }

  /**
   * Pelo `FieldPath`, e não por um caminho com pontos: o `sourceId` de uma tela costuma ter ponto
   * (`com.acme.pets.breeds`), e o caminho escrito à mão viraria mapas aninhados. O documento já existe:
   * a reserva (`claim`) o criou.
   */
  async saveScreen(
    tenantId: string,
    pluginId: string,
    sourceId: string,
    entry: ScreenSeedEntry,
    failures: ScreenSeedFailure[],
  ): Promise<void> {
    await this.ledger(tenantId, pluginId).update(
      new FieldPath('screens', sourceId, 'planned'), entry.planned,
      new FieldPath('failures', sourceId), failures,
      'updatedAt', new Date(),
    );
  }

  async markDelivered(tenantId: string, pluginId: string, sourceId: string, key: string): Promise<void> {
    await this.ledger(tenantId, pluginId).update(
      new FieldPath('screens', sourceId, 'delivered'), FieldValue.arrayUnion(key),
    );
  }
}
