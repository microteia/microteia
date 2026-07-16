import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IDocumentTypeRepository } from '../../domain/repositories/IDocumentTypeRepository';
import type { DocumentTypeConfig } from '../../domain/entities';
import { mergeLookupDefaults } from './mergeLookupDefaults';

const DEFAULT_DOCUMENT_TYPES: DocumentTypeConfig[] = [
  { key: 'Contrato', label: 'Contrato', isStatic: true },
  { key: 'Procuração', label: 'Procuração', isStatic: true },
  { key: 'Petição', label: 'Petição', isStatic: true },
  { key: 'Sentença', label: 'Sentença', isStatic: true },
  { key: 'Certidão', label: 'Certidão', isStatic: true },
  { key: 'RG', label: 'RG', isStatic: true },
  { key: 'CPF', label: 'CPF', isStatic: true },
  { key: 'Comprovante', label: 'Comprovante', isStatic: true },
  { key: 'Recibo', label: 'Recibo', isStatic: true },
  { key: 'Outros', label: 'Outros', isStatic: true },
];

export class FirebaseDocumentTypeRepository implements IDocumentTypeRepository {
  async getAll(tenantId: string): Promise<DocumentTypeConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'documentTypes');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicTypes = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        isStatic: false,
      }));
      return mergeLookupDefaults(DEFAULT_DOCUMENT_TYPES, dynamicTypes);
    } catch {
      return DEFAULT_DOCUMENT_TYPES;
    }
  }

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<DocumentTypeConfig> {
    const col = collection(db, 'tenants', tenantId, 'documentTypes');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'documentTypes');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
