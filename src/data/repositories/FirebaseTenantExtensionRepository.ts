import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { pruneUndefined } from '../utils/pruneUndefined';
import type { ITenantExtensionRepository } from '../../domain/repositories/ITenantExtensionRepository';
import type { TenantExtension } from '../../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date) ?? new Date());

const extensionsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'extensions');

const mapExtension = (id: string, tenantId: string, d: Record<string, unknown>): TenantExtension => ({
  id,
  tenantId,
  active: Boolean(d.active),
  package: (d.package as MarketplacePlugin) ?? { manifest: { id, version: '0.0.0', kernel: '*', name: id }, summary: '', workflows: [] },
  createdBy: (d.createdBy as string | undefined) ?? '',
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseTenantExtensionRepository implements ITenantExtensionRepository {
  subscribe(tenantId: string, onChange: (items: TenantExtension[]) => void): () => void {
    return onSnapshot(
      extensionsRef(tenantId),
      (snap) => onChange(snap.docs.map((s) => mapExtension(s.id, tenantId, s.data()))),
      (error) => console.error('[TenantExtensionRepository] subscribe:', error.message),
    );
  }

  async upsert(tenantId: string, extension: TenantExtension): Promise<void> {
    await setDoc(doc(extensionsRef(tenantId), extension.id), pruneUndefined({
      active: extension.active,
      package: extension.package,
      createdBy: extension.createdBy,
      createdAt: Timestamp.fromDate(extension.createdAt),
      updatedAt: serverTimestamp(),
    }));
  }

  async setActive(tenantId: string, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(extensionsRef(tenantId), id), { active, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(extensionsRef(tenantId), id));
  }
}
