import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { appliedBackendFromDoc } from './appliedBackendMapping';
import type { IAppliedBackendRepository } from '../../domain/repositories/IAppliedBackendRepository';
import type { AppliedBackend } from '../../domain/entities/AppliedBackend';

const STATE_COLLECTION = 'backend_state';
const APPLIED_DOCUMENT = 'applied';

export class FirebaseAppliedBackendRepository implements IAppliedBackendRepository {
  subscribe(onChange: (applied: AppliedBackend | null) => void): () => void {
    return onSnapshot(
      doc(db, STATE_COLLECTION, APPLIED_DOCUMENT),
      (snapshot) => onChange(snapshot.exists() ? appliedBackendFromDoc(snapshot.data()) : null),
      // Recusa vira ausência: o documento é um ATALHO, e sem ele vale o carimbo de cada cópia — a
      // falha fica fechada, que é o lado certo para errar.
      (error) => {
        console.error('[AppliedBackendRepository] subscribe:', error.message);
        onChange(null);
      },
    );
  }
}
