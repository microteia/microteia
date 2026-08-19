import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IExtensionMigrationRepository } from '../../domain/repositories/IExtensionMigrationRepository';
import type {
  AppliedMigration,
  ExtensionMigrationState,
  MigrationFailure,
  MigrationLock,
} from '../../domain/entities/ExtensionMigration';

const toDate = (value: unknown): Date =>
  value instanceof Timestamp ? value.toDate() : ((value as Date | undefined) ?? new Date());

const migrationsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'extension_migrations');

const mapApplied = (raw: unknown): AppliedMigration[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => typeof entry.id === 'string' && entry.id !== '')
    .map((entry) => ({
      id: entry.id as string,
      version: (entry.version as string | undefined) ?? '0.0.0',
      appliedAt: toDate(entry.appliedAt),
      appliedBy: (entry.appliedBy as string | undefined) ?? '',
      rounds: typeof entry.rounds === 'number' ? entry.rounds : 0,
      changed: typeof entry.changed === 'number' ? entry.changed : 0,
    }));
};

const mapFailure = (raw: unknown): MigrationFailure | null => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.message !== 'string' || d.message === '') return null;
  return {
    migrationId: (d.migrationId as string | undefined) ?? '',
    message: d.message,
    messageParams: (d.messageParams as Record<string, string> | undefined) ?? undefined,
    at: toDate(d.at),
  };
};

const mapLock = (raw: unknown): MigrationLock | null => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.runId !== 'string' || d.runId === '') return null;
  return { runId: d.runId, startedAt: toDate(d.startedAt), by: (d.by as string | undefined) ?? '' };
};

const mapState = (id: string, tenantId: string, d: Record<string, unknown>): ExtensionMigrationState => ({
  pluginId: id,
  tenantId,
  applied: mapApplied(d.applied),
  lastError: mapFailure(d.lastError),
  lock: mapLock(d.lock),
});

/**
 * O histórico de migração das extensões do escritório. Um documento por extensão, id = `pluginId`.
 *
 * `recordApplied` é ACUMULATIVO por leitura-e-escrita dentro de transação, e não por `arrayUnion`:
 * duas execuções da mesma migração produziriam entradas com timestamps diferentes, que `arrayUnion`
 * trataria como itens distintos e o conjunto aplicado passaria a ter duplicatas. Aqui a identidade é
 * o `id` da migração, e regravar substitui.
 */
export class FirebaseExtensionMigrationRepository implements IExtensionMigrationRepository {
  subscribe(tenantId: string, onChange: (states: ExtensionMigrationState[]) => void): () => void {
    return onSnapshot(
      migrationsRef(tenantId),
      (snap) => onChange(snap.docs.map((entry) => mapState(entry.id, tenantId, entry.data()))),
      (error) => console.error('[ExtensionMigrationRepository] subscribe:', error.message),
    );
  }

  async get(tenantId: string, pluginId: string): Promise<ExtensionMigrationState | null> {
    const snap = await getDoc(doc(migrationsRef(tenantId), pluginId));
    return snap.exists() ? mapState(snap.id, tenantId, snap.data()) : null;
  }

  /**
   * Reserva a execução. Transacional porque é exatamente aqui que dois admins clicando ao mesmo tempo
   * se encontram: quem chega depois lê a reserva de quem chegou antes e desiste — a menos que a
   * reserva já tenha expirado, o que devolve a extensão a quem quiser tentar de novo.
   */
  async claim(
    tenantId: string,
    pluginId: string,
    runId: string,
    by: string,
    staleBefore: Date,
  ): Promise<boolean> {
    const ref = doc(migrationsRef(tenantId), pluginId);
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = snap.exists() ? mapLock(snap.data().lock) : null;
      if (current && current.startedAt.getTime() >= staleBefore.getTime()) return false;
      transaction.set(
        ref,
        { pluginId, lock: { runId, startedAt: new Date(), by } },
        { merge: true },
      );
      return true;
    });
  }

  async release(tenantId: string, pluginId: string): Promise<void> {
    const ref = doc(migrationsRef(tenantId), pluginId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, { lock: deleteField() });
  }

  async recordApplied(tenantId: string, pluginId: string, applied: AppliedMigration[]): Promise<void> {
    if (applied.length === 0) return;
    const ref = doc(migrationsRef(tenantId), pluginId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = snap.exists() ? mapApplied(snap.data().applied) : [];
      const incoming = new Set(applied.map((entry) => entry.id));
      const next = [...current.filter((entry) => !incoming.has(entry.id)), ...applied];
      transaction.set(ref, { pluginId, applied: next }, { merge: true });
    });
  }

  async recordFailure(tenantId: string, pluginId: string, failure: MigrationFailure | null): Promise<void> {
    const ref = doc(migrationsRef(tenantId), pluginId);
    if (!failure) {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      await updateDoc(ref, { lastError: deleteField() });
      return;
    }
    await setDoc(
      ref,
      {
        pluginId,
        lastError: {
          migrationId: failure.migrationId,
          message: failure.message,
          ...(failure.messageParams ? { messageParams: failure.messageParams } : {}),
          at: failure.at,
        },
      },
      { merge: true },
    );
  }
}
