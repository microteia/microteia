import {
  addDoc,
  collection as firestoreCollection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ILookupRepository } from '../../domain/repositories/ILookupRepository';
import type { LookupOption } from '../../domain/entities';
import { lookupDefaultsFor } from './lookupDefaults';
import { mergeLookupDefaults } from './mergeLookupDefaults';
import { subscribeLookupCollection } from './subscribeLookupCollection';

const optionsRef = (tenantId: string, collection: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection);

const mapOption = (d: Record<string, unknown>): LookupOption => ({
  key: d.key as string,
  label: d.label as string,
  color: d.color as string | undefined,
  isStatic: false,
});

/**
 * Um repositório para TODAS as listas. Substitui os ~30 `Firebase*Repository` que só diferiam no
 * nome da coleção e nas opções fixas — estas agora vêm de `lookupDefaults.ts`, indexadas pela mesma
 * chave que o campo usa em `lookupCollection`.
 */
export class FirebaseLookupRepository implements ILookupRepository {
  subscribe(
    tenantId: string,
    collection: string,
    onChange: (options: LookupOption[]) => void,
  ): () => void {
    return subscribeLookupCollection<LookupOption>(
      tenantId,
      collection,
      lookupDefaultsFor(collection),
      onChange,
    );
  }

  async getAll(tenantId: string, collection: string): Promise<LookupOption[]> {
    const defaults = lookupDefaultsFor(collection);
    try {
      const snap = await getDocs(query(optionsRef(tenantId, collection), orderBy('label', 'asc')));
      return mergeLookupDefaults(defaults, snap.docs.map((d) => mapOption(d.data())));
    } catch {
      return defaults;
    }
  }

  async create(
    tenantId: string,
    collection: string,
    option: LookupOption,
    createdBy: string,
  ): Promise<LookupOption> {
    await addDoc(optionsRef(tenantId, collection), {
      key: option.key,
      label: option.label,
      ...(option.color ? { color: option.color } : {}),
      createdBy,
      createdAt: serverTimestamp(),
    });
    return { key: option.key, label: option.label, color: option.color, isStatic: false };
  }

  async delete(tenantId: string, collection: string, key: string): Promise<void> {
    const ref = optionsRef(tenantId, collection);
    const snap = await getDocs(query(ref, where('key', '==', key)));
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(ref, d.id))));
  }
}
