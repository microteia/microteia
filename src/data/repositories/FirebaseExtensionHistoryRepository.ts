import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { pruneUndefined } from '../utils/pruneUndefined';
import type { IExtensionHistoryRepository } from '../../domain/repositories/IExtensionHistoryRepository';
import type {
  ExtensionHistory,
  ExtensionHistoryEntry,
  ExtensionHistoryVersion,
} from '../../domain/entities/ExtensionHistory';
import type { InstalledExtensionSource } from '../../domain/entities/InstalledExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { historyHasRevision, pruneHistory } from '../../domain/usecases/plugins/extensionHistory';
import { toDateValueOrNow as toDate } from '../utils/toDateValue';

const historyRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'extension_history');

const versionsRef = (tenantId: string, pluginId: string) =>
  collection(doc(historyRef(tenantId), pluginId), 'versions');

const mapEntries = (raw: unknown): ExtensionHistoryEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => typeof entry.revision === 'string' && entry.revision !== '')
    .map((entry) => ({
      revision: entry.revision as string,
      version: (entry.version as string | undefined) ?? '0.0.0',
      source: (entry.source as InstalledExtensionSource | undefined) ?? 'public',
      appliedAt: toDate(entry.appliedAt),
      appliedBy: (entry.appliedBy as string | undefined) ?? '',
      appliedByName: (entry.appliedByName as string | undefined) ?? '',
    }));
};

const rawEntry = (entry: ExtensionHistoryEntry): Record<string, unknown> => ({
  revision: entry.revision,
  version: entry.version,
  source: entry.source,
  appliedAt: Timestamp.fromDate(entry.appliedAt),
  appliedBy: entry.appliedBy,
  appliedByName: entry.appliedByName,
});

const mapHistory = (id: string, tenantId: string, d: Record<string, unknown>): ExtensionHistory => ({
  pluginId: id,
  tenantId,
  entries: mapEntries(d.entries),
});

const mapVersion = (revision: string, d: Record<string, unknown>): ExtensionHistoryVersion | null => {
  const pkg = d.package as MarketplacePlugin | undefined;
  if (!pkg || typeof pkg !== 'object') return null;
  return {
    revision,
    package: pkg,
    source: (d.source as InstalledExtensionSource | undefined) ?? 'public',
    version: (d.version as string | undefined) ?? pkg.manifest?.version ?? '0.0.0',
    authorId: (d.authorId as string | undefined) ?? '',
    authorName: (d.authorName as string | undefined) ?? '',
    authorPhotoURL: (d.authorPhotoURL as string | null | undefined) ?? null,
  };
};

/**
 * O histórico de versões aplicadas das extensões do escritório. Um documento de ÍNDICE por extensão
 * (id = `pluginId`), e o pacote de cada entrada num documento próprio da subcoleção `versions`.
 *
 * A divisão existe porque as duas perguntas têm custos opostos: "esta extensão tem histórico?" é
 * feita a cada abertura da tela, para todas as extensões de uma vez, e "qual era o pacote da versão
 * 1.2.0?" é feita uma vez, por quem já decidiu voltar. Com o pacote dentro do índice, assinar o
 * histórico traria megabytes a cada carga — e o documento de índice estouraria o 1 MiB do Firestore
 * na terceira ou quarta versão de um pacote de tradução.
 */
export class FirebaseExtensionHistoryRepository implements IExtensionHistoryRepository {
  subscribe(tenantId: string, onChange: (histories: ExtensionHistory[]) => void): () => void {
    return onSnapshot(
      historyRef(tenantId),
      (snap) => onChange(snap.docs.map((entry) => mapHistory(entry.id, tenantId, entry.data()))),
      (error) => console.error('[ExtensionHistoryRepository] subscribe:', error.message),
    );
  }

  /**
   * Transacional porque a decisão de criar depende do que já está lá: dois admins aplicando ao mesmo
   * tempo leriam o mesmo índice e o segundo apagaria a entrada do primeiro. A poda entra na MESMA
   * transação que a entrada nova — o pacote podado sai junto com a linha dele, senão o teto seria só
   * da lista e os megabytes ficariam.
   */
  async record(
    tenantId: string,
    pluginId: string,
    entry: ExtensionHistoryEntry,
    version: ExtensionHistoryVersion,
  ): Promise<void> {
    const indexRef = doc(historyRef(tenantId), pluginId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(indexRef);
      const current: ExtensionHistory = snap.exists()
        ? mapHistory(pluginId, tenantId, snap.data())
        : { pluginId, tenantId, entries: [] };
      // Reaplicar uma versão que veio do próprio histórico não cria item novo: ela já está lá.
      if (historyHasRevision(current, entry.revision)) return;

      const pruned = pruneHistory([entry, ...current.entries]);
      transaction.set(indexRef, { pluginId, entries: pruned.entries.map(rawEntry) });
      transaction.set(doc(versionsRef(tenantId, pluginId), entry.revision), {
        revision: entry.revision,
        package: pruneUndefined(version.package),
        source: version.source,
        version: version.version,
        authorId: version.authorId,
        authorName: version.authorName,
        authorPhotoURL: version.authorPhotoURL ?? null,
      });
      for (const gone of pruned.dropped) {
        transaction.delete(doc(versionsRef(tenantId, pluginId), gone.revision));
      }
    });
  }

  async getVersion(
    tenantId: string,
    pluginId: string,
    revision: string,
  ): Promise<ExtensionHistoryVersion | null> {
    const snap = await getDoc(doc(versionsRef(tenantId, pluginId), revision));
    return snap.exists() ? mapVersion(snap.id, snap.data()) : null;
  }

  async deleteAll(tenantId: string, pluginId: string): Promise<void> {
    const snap = await getDocs(versionsRef(tenantId, pluginId));
    await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref)));
    await deleteDoc(doc(historyRef(tenantId), pluginId));
  }
}
