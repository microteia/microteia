import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type {
  ActionDefinitionInput,
  IActionRepository,
  RunActionInput,
  RunActionResult,
} from '../../domain/repositories/IActionRepository';
import type { ActionDefinition, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const actionsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'actions');

const mapAction = (id: string, d: Record<string, unknown>, tenantId: string): ActionDefinition => ({
  id,
  tenantId,
  key: (d.key as string | undefined) ?? '',
  title: (d.title as string | undefined) ?? '',
  icon: (d.icon as string | undefined) ?? 'apps',
  workflowId: (d.workflowId as string | undefined) ?? '',
  hiddenWhen: (d.hiddenWhen as string | null | undefined) ?? null,
  activeWhen: (d.activeWhen as string | null | undefined) ?? null,
  disabledWhen: (d.disabledWhen as string | null | undefined) ?? null,
  confirmMessage: (d.confirmMessage as string | null | undefined) ?? null,
  danger: (d.danger as boolean | undefined) ?? false,
  enabled: (d.enabled as boolean | undefined) ?? true,
  order: (d.order as number | undefined) ?? 0,
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  ownerPluginIds: (d.ownerPluginIds as string[] | null | undefined) ?? null,
  sourceId: (d.sourceId as string | null | undefined) ?? null,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
});

// O Firestore rejeita `undefined`, e um campo opcional ausente chega assim. Ausente some;
// para limpar um valor gravado, use `null`.
const stripUndefined = <T extends object>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

export class FirebaseActionRepository implements IActionRepository {
  async getAll(tenantId: string): Promise<ActionDefinition[]> {
    const snap = await getDocs(query(actionsRef(tenantId), orderBy('order', 'asc')));
    return snap.docs.map((d) => mapAction(d.id, d.data(), tenantId));
  }

  subscribeToActions(tenantId: string, onUpdate: (actions: ActionDefinition[]) => void): () => void {
    return onSnapshot(query(actionsRef(tenantId), orderBy('order', 'asc')), (snap) => {
      onUpdate(snap.docs.map((d) => mapAction(d.id, d.data(), tenantId)));
    });
  }

  async getById(tenantId: string, actionId: string): Promise<ActionDefinition | null> {
    const snap = await getDoc(doc(actionsRef(tenantId), actionId));
    return snap.exists() ? mapAction(snap.id, snap.data(), tenantId) : null;
  }

  async create(tenantId: string, data: ActionDefinitionInput): Promise<ActionDefinition> {
    const ref = await addDoc(actionsRef(tenantId), {
      ...stripUndefined(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapAction(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async update(tenantId: string, actionId: string, data: Partial<ActionDefinitionInput>): Promise<void> {
    const updatable = stripUndefined({ ...data });
    delete updatable.createdBy;
    await updateDoc(doc(actionsRef(tenantId), actionId), { ...updatable, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, actionId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(actionsRef(tenantId), actionId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async runAction(input: RunActionInput): Promise<RunActionResult> {
    const call = httpsCallable<RunActionInput, RunActionResult>(functions, 'runAction');
    const response = await call(input);
    return response.data;
  }
}
