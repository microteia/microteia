import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { backendResidueFromDoc } from './backendResidueMapping';
import type { IBackendResidueRepository } from '../../domain/repositories/IBackendResidueRepository';
import type { BackendResidue } from '../../domain/entities/BackendResidue';

/**
 * `backend_state/current` — um documento só, global, escrito pelo Microteia Console com credencial de
 * administrador. A regra do Firestore nega escrita ao cliente, e é por isso que este repositório só lê.
 */
const RESIDUE_COLLECTION = 'backend_state';
const RESIDUE_DOCUMENT = 'current';

export class FirebaseBackendResidueRepository implements IBackendResidueRepository {
  async get(): Promise<BackendResidue | null> {
    /**
     * Leitura recusada devolve `null` em vez de estourar. O documento existe para AVISAR, e um aviso que
     * derruba a tela em que ele apareceria custa mais que a ausência dele.
     */
    try {
      const snapshot = await getDoc(doc(db, RESIDUE_COLLECTION, RESIDUE_DOCUMENT));
      return snapshot.exists() ? backendResidueFromDoc(snapshot.data()) : null;
    } catch {
      return null;
    }
  }
}
