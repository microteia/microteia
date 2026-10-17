import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { DownloadsScope, IDownloadRepository } from '../../domain/repositories/IDownloadRepository';
import type { DownloadItem, DownloadVisibility } from '../../domain/schema/document/documentDownloads';
import { DOWNLOADS_COLLECTION } from '../../domain/schema/document/documentDownloads';

const PAGE_LIMIT = 100;

const downloadsRef = (tenantId: string) => collection(db, 'tenants', tenantId, DOWNLOADS_COLLECTION);

const dateOf = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

const VIA = new Set(['agent', 'automation', 'ui']);

const VISIBILITY = new Set<DownloadVisibility>(['owner', 'everyone', 'managers']);

const mapDownload = (id: string, data: Record<string, unknown>): DownloadItem => {
  const origin = data.origin as { collection?: unknown; recordId?: unknown } | undefined;
  return {
    id,
    name: textOf(data.name),
    url: textOf(data.url),
    storagePath: textOf(data.storagePath),
    contentType: textOf(data.contentType),
    size: typeof data.size === 'number' ? data.size : 0,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : null,
    visibility: VISIBILITY.has(data.visibility as DownloadVisibility) ? (data.visibility as DownloadVisibility) : 'owner',
    ...(typeof data.templateKey === 'string' ? { templateKey: data.templateKey } : {}),
    ...(origin && typeof origin.collection === 'string' && typeof origin.recordId === 'string'
      ? { origin: { collection: origin.collection, recordId: origin.recordId } }
      : {}),
    createdBy: textOf(data.createdBy),
    ...(typeof data.createdByName === 'string' ? { createdByName: data.createdByName } : {}),
    createdVia: VIA.has(textOf(data.createdVia)) ? (data.createdVia as DownloadItem['createdVia']) : 'ui',
    createdAt: dateOf(data.createdAt),
    expiresAt: dateOf(data.expiresAt),
  };
};

const newestFirst = (a: DownloadItem, b: DownloadItem): number =>
  (b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER);

export class FirebaseDownloadRepository implements IDownloadRepository {
  subscribe(
    tenantId: string,
    scope: DownloadsScope,
    onUpdate: (items: DownloadItem[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const filters: QueryConstraint[][] = scope.seeAll
      ? [[]]
      : [[where('ownerId', '==', scope.userId)], [where('visibility', '==', 'everyone')]];

    const parts = filters.map(() => new Map<string, DownloadItem>());
    const emit = () => {
      const merged = new Map<string, DownloadItem>();
      for (const part of parts) for (const [id, item] of part) merged.set(id, item);
      onUpdate([...merged.values()].sort(newestFirst));
    };

    const unsubscribes = filters.map((constraints, index) =>
      onSnapshot(
        query(downloadsRef(tenantId), ...constraints, orderBy('createdAt', 'desc'), limit(PAGE_LIMIT)),
        (snap) => {
          parts[index] = new Map(snap.docs.map((one) => [one.id, mapDownload(one.id, one.data())]));
          emit();
        },
        (error) => onError?.(error),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  async delete(tenantId: string, downloadId: string): Promise<void> {
    await deleteDoc(doc(downloadsRef(tenantId), downloadId));
  }
}
