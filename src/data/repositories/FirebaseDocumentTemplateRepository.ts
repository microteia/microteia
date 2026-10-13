import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type {
  DocumentTemplateInput,
  GenerateDocumentInput,
  GenerateDocumentResult,
  IDocumentTemplateRepository,
} from '../../domain/repositories/IDocumentTemplateRepository';
import type { DocumentTemplate } from '../../domain/schema/document/documentTemplate';
import { DOCUMENT_TEMPLATES_COLLECTION } from '../../domain/schema/document/documentTemplate';

const templatesRef = (tenantId: string) => collection(db, 'tenants', tenantId, DOCUMENT_TEMPLATES_COLLECTION);

/** O documento é gravado VERBATIM, como o `spec` de um relatório: chave que esta versão não conhece sobrevive. */
const mapTemplate = (id: string, data: Record<string, unknown>): DocumentTemplate => ({
  ...(data as Omit<DocumentTemplate, 'id'>),
  id,
  key: typeof data.key === 'string' ? data.key : id,
  updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
});

const withoutUndefined = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

export class FirebaseDocumentTemplateRepository implements IDocumentTemplateRepository {
  subscribe(tenantId: string, onUpdate: (templates: DocumentTemplate[]) => void): () => void {
    return onSnapshot(templatesRef(tenantId), (snap) => {
      onUpdate(snap.docs.map((one) => mapTemplate(one.id, one.data())));
    });
  }

  async getAll(tenantId: string): Promise<DocumentTemplate[]> {
    const snap = await getDocs(templatesRef(tenantId));
    return snap.docs.map((one) => mapTemplate(one.id, one.data()));
  }

  async save(tenantId: string, input: DocumentTemplateInput, updatedBy: string | null): Promise<void> {
    await setDoc(doc(templatesRef(tenantId), input.key), {
      ...withoutUndefined({ ...input }),
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  }

  async delete(tenantId: string, key: string): Promise<void> {
    await deleteDoc(doc(templatesRef(tenantId), key));
  }

  async generate(input: GenerateDocumentInput): Promise<GenerateDocumentResult> {
    const call = httpsCallable<GenerateDocumentInput, GenerateDocumentResult>(functions, 'renderDocument');
    const response = await call(input);
    return response.data;
  }
}
