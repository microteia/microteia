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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type {
  IScriptRepository,
  RunScriptInput,
  RunScriptResult,
} from '../../domain/repositories/IScriptRepository';
import type { Script, ScriptOutputParam } from '../../domain/entities/Script';
import type { WorkflowParameter } from '../../domain/entities/Workflow';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const scriptsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'scripts');

const mapScript = (id: string, d: Record<string, unknown>, tenantId: string): Script => ({
  id,
  tenantId,
  name: d.name as string,
  description: (d.description as string | undefined) ?? undefined,
  sourceTs: (d.sourceTs as string | undefined) ?? '',
  compiledJs: (d.compiledJs as string | undefined) ?? '',
  inputParams: (d.inputParams as WorkflowParameter[] | undefined) ?? [],
  outputParams: (d.outputParams as ScriptOutputParam[] | undefined) ?? [],
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseScriptRepository implements IScriptRepository {
  async runScript(input: RunScriptInput): Promise<RunScriptResult> {
    const call = httpsCallable<RunScriptInput, RunScriptResult>(functions, 'runScript');
    const result = await call(input);
    return result.data;
  }

  async getScripts(tenantId: string): Promise<Script[]> {
    const q = query(scriptsRef(tenantId), orderBy('name', 'asc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapScript(d.id, d.data(), tenantId));
  }

  subscribeToScripts(tenantId: string, onUpdate: (scripts: Script[]) => void): () => void {
    const q = query(scriptsRef(tenantId), orderBy('name', 'asc'), limit(500));
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => mapScript(d.id, d.data(), tenantId))),
      (error) => console.error('[ScriptRepository] subscribeToScripts:', error.message),
    );
  }

  async getScriptById(tenantId: string, id: string): Promise<Script | null> {
    const snap = await getDoc(doc(scriptsRef(tenantId), id));
    if (!snap.exists()) return null;
    return mapScript(snap.id, snap.data(), tenantId);
  }

  async createScript(
    tenantId: string,
    data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Script> {
    const ref = await addDoc(scriptsRef(tenantId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapScript(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateScript(
    tenantId: string,
    id: string,
    data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void> {
    await updateDoc(doc(scriptsRef(tenantId), id), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteScript(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(scriptsRef(tenantId), id));
  }
}
