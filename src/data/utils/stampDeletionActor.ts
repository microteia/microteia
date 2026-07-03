import { updateDoc, type DocumentReference } from 'firebase/firestore';
import type { DeletionActor } from '../../domain/entities';

export const stampDeletionActor = (ref: DocumentReference, actor: DeletionActor): Promise<void> =>
  updateDoc(ref, {
    deletedBy: actor.uid,
    deletedByName: actor.name,
    deletedByPhotoURL: actor.photoURL,
  });
