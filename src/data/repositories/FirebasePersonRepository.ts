import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPersonRepository } from '../../domain/repositories/IPersonRepository';
import type { Person, PersonStatus, Gender, DeletionActor, CustomFieldValue } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  return v instanceof Timestamp ? v.toDate() : (v as Date);
};

const personsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'persons');

const mapPerson = (id: string, d: Record<string, unknown>, tenantId: string): Person => ({
  id,
  tenantId,
  type: d.type as Person['type'],
  name: d.name as string,
  cpf: (d.cpf as string | null) ?? null,
  cnpj: (d.cnpj as string | null) ?? null,
  email: (d.email as string | null) ?? null,
  phone: (d.phone as string | null) ?? null,
  secondaryPhone: (d.secondaryPhone as string | null) ?? null,
  address: (d.address as Person['address']) ?? null,
  occupation: (d.occupation as string | null) ?? null,
  nationality: (d.nationality as string | null) ?? null,
  maritalStatus: (d.maritalStatus as string | null) ?? null,
  relationship: (d.relationship as string | null) ?? null,
  birthDate: toDateOrNull(d.birthDate),
  gender: (d.gender as Gender | null) ?? null,
  notes: (d.notes as string | null) ?? null,
  tagIds: (d.tagIds as string[] | undefined) ?? [],
  status: (d.status as PersonStatus) ?? 'Ativo',
  customValues: (d.customValues as Record<string, CustomFieldValue> | undefined) ?? {},
  createdAt: toDate(d.createdAt),
  createdBy: d.createdBy as string,
  updatedAt: toDate(d.updatedAt),
});

export class FirebasePersonRepository implements IPersonRepository {
  async getPersons(tenantId: string): Promise<Person[]> {
    const q = query(personsRef(tenantId), orderBy('name', 'asc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapPerson(d.id, d.data(), tenantId));
  }

  subscribeToPersons(tenantId: string, onUpdate: (persons: Person[]) => void): () => void {
    const q = query(personsRef(tenantId), orderBy('name', 'asc'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapPerson(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[PersonRepository] subscribeToPersons:', error.message);
      },
    );
  }

  async getPersonById(tenantId: string, personId: string): Promise<Person | null> {
    const snap = await getDoc(doc(personsRef(tenantId), personId));
    if (!snap.exists()) return null;
    return mapPerson(snap.id, snap.data(), tenantId);
  }

  async createPerson(tenantId: string, data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Person> {
    const ref = await addDoc(personsRef(tenantId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapPerson(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updatePerson(tenantId: string, personId: string, data: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    await updateDoc(doc(personsRef(tenantId), personId), { ...data, updatedAt: serverTimestamp() });
  }

  async updatePersonStatus(tenantId: string, personId: string, status: PersonStatus): Promise<void> {
    await updateDoc(doc(personsRef(tenantId), personId), { status, updatedAt: serverTimestamp() });
  }

  async updatePersonTags(tenantId: string, personId: string, tagIds: string[]): Promise<void> {
    await updateDoc(doc(personsRef(tenantId), personId), { tagIds, updatedAt: serverTimestamp() });
  }

  async deletePerson(tenantId: string, personId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(personsRef(tenantId), personId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
