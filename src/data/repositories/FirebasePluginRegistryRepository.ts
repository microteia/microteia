import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { pruneUndefined } from '../utils/pruneUndefined';
import type {
  IPluginRegistryRepository,
  PublishedPlugin,
} from '../../domain/repositories/IPluginRegistryRepository';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date) ?? new Date());

const registryRef = () => collection(db, 'plugin_registry');

const mapPlugin = (id: string, d: Record<string, unknown>): PublishedPlugin => ({
  manifest: (d.manifest as PublishedPlugin['manifest']) ?? { id, version: '0.0.0', kernel: '*', name: id },
  summary: (d.summary as string | undefined) ?? '',
  workflows: (d.workflows as PublishedPlugin['workflows']) ?? [],
  publishedAt: toDate(d.publishedAt),
  publishedBy: (d.publishedBy as string | undefined) ?? '',
});

export class FirebasePluginRegistryRepository implements IPluginRegistryRepository {
  subscribe(onUpdate: (plugins: PublishedPlugin[]) => void): () => void {
    return onSnapshot(registryRef(), (snap) => {
      onUpdate(snap.docs.map((docSnap) => mapPlugin(docSnap.id, docSnap.data())));
    });
  }

  async getAll(): Promise<PublishedPlugin[]> {
    const snap = await getDocs(registryRef());
    return snap.docs.map((docSnap) => mapPlugin(docSnap.id, docSnap.data()));
  }

  async publish(plugin: MarketplacePlugin, publishedBy: string): Promise<void> {
    await setDoc(doc(registryRef(), plugin.manifest.id), {
      ...pruneUndefined({
        manifest: plugin.manifest,
        summary: plugin.summary,
        workflows: plugin.workflows,
      }),
      publishedBy,
      publishedAt: serverTimestamp(),
    });
  }

  async unpublish(pluginId: string): Promise<void> {
    await deleteDoc(doc(registryRef(), pluginId));
  }
}
