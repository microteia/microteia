import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPluginInstallationRepository } from '../../domain/repositories/IPluginInstallationRepository';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date) ?? new Date());

const installationsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'plugin_installations');

const mapInstallation = (
  pluginId: string,
  d: Record<string, unknown>,
  tenantId: string,
): PluginInstallation => ({
  pluginId,
  tenantId,
  version: (d.version as string | undefined) ?? '0.0.0',
  enabled: (d.enabled as boolean | undefined) ?? false,
  config: (d.config as Record<string, unknown> | undefined) ?? {},
  grantedPermissions: (d.grantedPermissions as string[] | undefined) ?? [],
  installedAt: toDate(d.installedAt),
  installedBy: (d.installedBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
});

export class FirebasePluginInstallationRepository implements IPluginInstallationRepository {
  async getAll(tenantId: string): Promise<PluginInstallation[]> {
    const snap = await getDocs(installationsRef(tenantId));
    return snap.docs.map((docSnap) => mapInstallation(docSnap.id, docSnap.data(), tenantId));
  }

  async getById(tenantId: string, pluginId: string): Promise<PluginInstallation | null> {
    const snap = await getDoc(doc(installationsRef(tenantId), pluginId));
    return snap.exists() ? mapInstallation(snap.id, snap.data(), tenantId) : null;
  }

  subscribe(tenantId: string, onUpdate: (installations: PluginInstallation[]) => void): () => void {
    return onSnapshot(installationsRef(tenantId), (snap) => {
      onUpdate(snap.docs.map((docSnap) => mapInstallation(docSnap.id, docSnap.data(), tenantId)));
    });
  }

  async save(installation: PluginInstallation): Promise<void> {
    await setDoc(doc(installationsRef(installation.tenantId), installation.pluginId), {
      version: installation.version,
      enabled: installation.enabled,
      config: installation.config,
      grantedPermissions: installation.grantedPermissions,
      installedAt: installation.installedAt instanceof Date ? installation.installedAt : serverTimestamp(),
      installedBy: installation.installedBy,
      updatedAt: serverTimestamp(),
      updatedBy: installation.updatedBy ?? installation.installedBy,
    });
  }

  async delete(tenantId: string, pluginId: string): Promise<void> {
    await deleteDoc(doc(installationsRef(tenantId), pluginId));
  }
}
