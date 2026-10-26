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
import type { SeededLookupOptions } from '../../domain/schema/lookupSeed';
import { db } from '../../infrastructure/firebase/config';
import { pruneUndefined } from '../utils/pruneUndefined';
import type { IInstalledExtensionRepository } from '../../domain/repositories/IInstalledExtensionRepository';
import type {
  ExtensionBackendState,
  ExtensionCodeTrust,
  InstalledExtension,
  InstalledExtensionSource,
} from '../../domain/entities/InstalledExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { toDateValueOrNow as toDate } from '../utils/toDateValue';

const mapCodeTrust = (raw: unknown): ExtensionCodeTrust | null => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.hash !== 'string' || d.hash === '') return null;
  return {
    hash: d.hash,
    trustedBy: (d.trustedBy as string | undefined) ?? '',
    trustedByName: (d.trustedByName as string | undefined) ?? '',
    trustedAt: toDate(d.trustedAt),
  };
};

/**
 * O `backendState` é escrito pelo Microteia Console, pela REST do Firestore — então `appliedAt` chega
 * como string ISO, e não como `Timestamp`.
 *
 * A conversão é `toDateValueOrNow`, e não um `toDate` local, porque o local NÃO tratava esse caso: o
 * cast `(v as Date)` deixava a string passar inteira, com o tipo de `Date` e nenhum dos métodos dela.
 * Nada acusava na leitura — o erro só aparecia na gravação seguinte, no `Timestamp.fromDate` do
 * `upsert`, como `t.getTime is not a function`, sem dizer o campo nem quem o havia gravado. Era
 * preciso ter provisionado o backend uma vez para conseguir reproduzir.
 */
const mapBackendState = (raw: unknown): ExtensionBackendState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.fingerprint !== 'string' || d.fingerprint === '') return null;
  return { fingerprint: d.fingerprint, appliedAt: toDate(d.appliedAt) };
};

const mapSeededLookupOptions = (raw: unknown): SeededLookupOptions | null => {
  if (!raw || typeof raw !== 'object') return null;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
    .map(([collection, keys]) => [collection, keys.filter((key): key is string => typeof key === 'string')] as const);
  return Object.fromEntries(entries);
};

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
  codeTrust: mapCodeTrust(d.codeTrust),
  backendState: mapBackendState(d.backendState),
  seededLookupOptions: mapSeededLookupOptions(d.seededLookupOptions),
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
      codeTrust: extension.codeTrust
        ? { ...extension.codeTrust, trustedAt: Timestamp.fromDate(extension.codeTrust.trustedAt) }
        : null,
      // Preservado, não recalculado: quem carimba é o Console, e uma reinstalação não pode apagar o
      // que já foi aplicado no projeto. Quando o exigido muda, é o FINGERPRINT que deixa de bater —
      // não há nada a zerar aqui.
      backendState: extension.backendState
        ? {
          fingerprint: extension.backendState.fingerprint,
          appliedAt: Timestamp.fromDate(extension.backendState.appliedAt),
        }
        : null,
      seededLookupOptions: extension.seededLookupOptions ?? null,
      installedAt: Timestamp.fromDate(extension.installedAt),
      updatedAt: serverTimestamp(),
    });
  }

  async setActive(tenantId: string, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(installedRef(tenantId), id), { active, updatedAt: serverTimestamp() });
  }

  async setCodeTrust(tenantId: string, id: string, trust: ExtensionCodeTrust | null): Promise<void> {
    await updateDoc(doc(installedRef(tenantId), id), {
      codeTrust: trust ? { ...trust, trustedAt: Timestamp.fromDate(trust.trustedAt) } : null,
      updatedAt: serverTimestamp(),
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(installedRef(tenantId), id));
  }
}
