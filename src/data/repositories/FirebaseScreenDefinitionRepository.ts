import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../domain/repositories/IScreenDefinitionRepository';
import type { DeletionActor, ScreenDefinition } from '../../domain/entities';
import { pruneUndefined } from '../utils/pruneUndefined';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { mapScreenDefinition } from './screenDefinitionMapper';


const definitionsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions');


export class FirebaseScreenDefinitionRepository implements IScreenDefinitionRepository {
  async getAll(tenantId: string): Promise<ScreenDefinition[]> {
    const snap = await getDocs(query(definitionsRef(tenantId), orderBy('sidebarOrder', 'asc')));
    return snap.docs.map((d) => mapScreenDefinition(d.id, d.data(), tenantId));
  }

  async upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput): Promise<ScreenDefinition> {
    const ref = doc(definitionsRef(tenantId), screenKey);
    // O Firestore rejeita `undefined`, e um campo opcional ausente chega assim. Ausente some;
    // para limpar um valor gravado, use `null`. A limpeza é PROFUNDA porque `fields[]` é uma lista
    // de objetos: um único opcional ausente lá dentro derrubava a gravação da tela inteira.
    data = pruneUndefined(data);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const updatable: Partial<ScreenDefinitionInput> = { ...data };
      delete updatable.createdBy;
      await updateDoc(ref, { ...updatable, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    const snap = await getDoc(ref);
    return mapScreenDefinition(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async delete(tenantId: string, screenKey: string, actor: DeletionActor): Promise<void> {
    const ref = doc(definitionsRef(tenantId), screenKey);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

}
