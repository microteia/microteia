import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPersonLookupRepository } from '../../domain/repositories/IPersonLookupRepository';
import type { PersonLookupConfig, PersonLookupKind } from '../../domain/entities';

const COLLECTION_NAMES: Record<PersonLookupKind, string> = {
  types:          'personTypes',
  occupations:    'personOccupations',
  nationalities:  'personNationalities',
  maritalStatuses:'personMaritalStatuses',
  cities:         'personCities',
  relationships:  'personRelationships',
};

const STATIC_DEFAULTS: Record<PersonLookupKind, PersonLookupConfig[]> = {
  types: [
    { key: 'Pessoa Física',    label: 'Pessoa Física',    isStatic: true },
    { key: 'Pessoa Jurídica',  label: 'Pessoa Jurídica',  isStatic: true },
  ],
  occupations:    [],
  nationalities:  [
    { key: 'Brasileira', label: 'Brasileira', isStatic: true },
  ],
  maritalStatuses: [
    { key: 'Solteiro(a)',     label: 'Solteiro(a)',     isStatic: true },
    { key: 'Casado(a)',       label: 'Casado(a)',       isStatic: true },
    { key: 'Divorciado(a)',   label: 'Divorciado(a)',   isStatic: true },
    { key: 'Viúvo(a)',        label: 'Viúvo(a)',        isStatic: true },
    { key: 'União estável',   label: 'União estável',   isStatic: true },
  ],
  cities:         [],
  relationships:  [
    { key: 'Cliente',    label: 'Cliente',    color: 'relationshipCliente',    isStatic: true },
    { key: 'Parte',      label: 'Parte',      color: 'relationshipParte',      isStatic: true },
    { key: 'Contato',    label: 'Contato',    color: 'relationshipContato',    isStatic: true },
    { key: 'Fornecedor', label: 'Fornecedor', color: 'relationshipFornecedor', isStatic: true },
    { key: 'Sócio',      label: 'Sócio',      color: 'relationshipSocio',      isStatic: true },
  ],
};

export class FirebasePersonLookupRepository implements IPersonLookupRepository {
  async getAll(tenantId: string, kind: PersonLookupKind): Promise<PersonLookupConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamic = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamic.map((a) => a.key));
      const statics = STATIC_DEFAULTS[kind].filter((s) => !dynamicKeys.has(s.key));
      return [...statics, ...dynamic].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return STATIC_DEFAULTS[kind];
    }
  }

  async create(tenantId: string, kind: PersonLookupKind, name: string, createdBy: string, color?: string): Promise<PersonLookupConfig> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const data: Record<string, unknown> = { key: name, label: name, createdBy, createdAt: new Date() };
    if (color) data.color = color;
    await addDoc(col, data);
    return { key: name, label: name, color };
  }

  async delete(tenantId: string, kind: PersonLookupKind, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
  }
}
