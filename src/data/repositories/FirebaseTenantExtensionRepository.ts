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
  createdByName: (d.createdByName as string | undefined) ?? undefined,
  createdByPhotoURL: (d.createdByPhotoURL as string | null | undefined) ?? null,
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
    // Só o pacote passa por pruneUndefined; os carimbos do Firestore (Timestamp/serverTimestamp) NÃO
    // podem ser percorridos por pruneUndefined — isso destruía o sentinel e gravava um mapa no lugar
    // da data. `setDoc` sobrescreve o doc (cria ou atualiza), então salvar de novo é idempotente.
    await setDoc(doc(extensionsRef(tenantId), extension.id), {
      active: extension.active,
      package: pruneUndefined(extension.package),
      createdBy: extension.createdBy,
      createdByName: extension.createdByName ?? null,
      createdByPhotoURL: extension.createdByPhotoURL ?? null,
      createdAt: Timestamp.fromDate(extension.createdAt),
      updatedAt: serverTimestamp(),
    });
  }

  async setActive(tenantId: string, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(extensionsRef(tenantId), id), { active, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(extensionsRef(tenantId), id));
  }
}
