import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { publicExtensionDataFromInput, publicExtensionFromDoc } from './publicExtensionMapping';
import type {
  IPublicExtensionRepository,
  PublishPublicExtensionInput,
} from '../../domain/repositories/IPublicExtensionRepository';
import type { PublicExtension, PublicExtensionStatus } from '../../domain/entities/PublicExtension';

const publicRef = () => collection(db, 'public_extensions');

export class FirebasePublicExtensionRepository implements IPublicExtensionRepository {
  subscribe(onChange: (items: PublicExtension[]) => void): () => void {
    return onSnapshot(
      publicRef(),
      (snap) => onChange(snap.docs.map((s) => publicExtensionFromDoc(s.id, s.data()))),
      (error) => console.error('[PublicExtensionRepository] subscribe:', error.message),
    );
  }

  async publish(input: PublishPublicExtensionInput): Promise<void> {
    await setDoc(doc(publicRef(), input.package.manifest.id), {
      ...publicExtensionDataFromInput(input),
      publishedAt: serverTimestamp(),
    });
  }

  async setStatus(domain: string, status: PublicExtensionStatus): Promise<void> {
    await updateDoc(doc(publicRef(), domain), { status });
  }

  async delete(domain: string): Promise<void> {
    await deleteDoc(doc(publicRef(), domain));
  }
}
