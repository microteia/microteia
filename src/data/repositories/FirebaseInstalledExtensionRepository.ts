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
import type { IInstalledExtensionRepository } from '../../domain/repositories/IInstalledExtensionRepository';
import type { InstalledExtension, InstalledExtensionSource } from '../../domain/entities/InstalledExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date) ?? new Date());

const installedRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'installed_extensions');

const mapInstalled = (id: string, tenantId: string, d: Record<string, unknown>): InstalledExtension => ({
  id,
  tenantId,
  active: Boolean(d.active),
  package: (d.package as MarketplacePlugin) ?? { manifest: { id, version: '0.0.0', kernel: '*', name: id }, summary: '', workflows: [] },
  source: (d.source as InstalledExtensionSource | undefined) ?? 'public',
  installedVersion: (d.installedVersion as string | undefined) ?? '0.0.0',
  authorId: (d.authorId as string | undefined) ?? '',
  authorName: (d.authorName as string | undefined) ?? '',
  authorPhotoURL: (d.authorPhotoURL as string | null | undefined) ?? null,
  installedBy: (d.installedBy as string | undefined) ?? '',
  installedAt: toDate(d.installedAt),
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseInstalledExtensionRepository implements IInstalledExtensionRepository {
  subscribe(tenantId: string, onChange: (items: InstalledExtension[]) => void): () => void {
    return onSnapshot(
      installedRef(tenantId),
      (snap) => onChange(snap.docs.map((s) => mapInstalled(s.id, tenantId, s.data()))),
      (error) => console.error('[InstalledExtensionRepository] subscribe:', error.message),
    );
  }

  async upsert(tenantId: string, extension: InstalledExtension): Promise<void> {
    // Só o pacote passa por pruneUndefined; os carimbos do Firestore ficam de fora (pruneUndefined
    // percorreria o sentinel e gravaria um mapa no lugar da data). `setDoc` cria ou sobrescreve.
    await setDoc(doc(installedRef(tenantId), extension.id), {
      active: extension.active,
      package: pruneUndefined(extension.package),
      source: extension.source,
      installedVersion: extension.installedVersion,
      authorId: extension.authorId,
      authorName: extension.authorName,
      authorPhotoURL: extension.authorPhotoURL ?? null,
      installedBy: extension.installedBy,
      installedAt: Timestamp.fromDate(extension.installedAt),
      updatedAt: serverTimestamp(),
    });
  }

  async setActive(tenantId: string, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(installedRef(tenantId), id), { active, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(installedRef(tenantId), id));
  }
}
