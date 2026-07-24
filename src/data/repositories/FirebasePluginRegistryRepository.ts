import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { pluginFromRegistryDoc, registryDataFromPlugin } from './pluginRegistryMapping';
import type {
  IPluginRegistryRepository,
  PublishedPlugin,
} from '../../domain/repositories/IPluginRegistryRepository';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

const registryRef = () => collection(db, 'plugin_registry');

export class FirebasePluginRegistryRepository implements IPluginRegistryRepository {
  subscribe(onUpdate: (plugins: PublishedPlugin[]) => void): () => void {
    return onSnapshot(registryRef(), (snap) => {
      onUpdate(snap.docs.map((docSnap) => pluginFromRegistryDoc(docSnap.id, docSnap.data())));
    });
  }

  async getAll(): Promise<PublishedPlugin[]> {
    const snap = await getDocs(registryRef());
    return snap.docs.map((docSnap) => pluginFromRegistryDoc(docSnap.id, docSnap.data()));
  }

  async publish(plugin: MarketplacePlugin, publishedBy: string): Promise<void> {
    await setDoc(doc(registryRef(), plugin.manifest.id), {
      ...registryDataFromPlugin(plugin),
      publishedBy,
      publishedAt: serverTimestamp(),
    });
  }

  async unpublish(pluginId: string): Promise<void> {
    await deleteDoc(doc(registryRef(), pluginId));
  }
}
