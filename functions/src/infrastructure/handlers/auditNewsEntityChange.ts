import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { asString, truncate } from '../../domain/services/auditableEntities';
import { computeChangedFields, normalizeAllFields, buildAuditText, resolveSeverity, ACTION_TITLE } from '../../domain/services/auditDiff';
import { logAuditError } from './shared/logAuditError';
import type { AuditAction } from '../../domain/entities/AuditLog';

type EntityData = Record<string, unknown>;

/**
 * Notícias, Comentários de Notícias e Etiquetas de Notícias denormalizam `authorName`/
 * `authorPhotoURL` na criação e `editedByName` (sem uid) na edição. Para DELETE, usa o
 * stamp `deletedBy`/`deletedByName`/`deletedByPhotoURL` (gravado por `stampDeletionActor`
 * logo antes do `deleteDoc`, mesmo padrão de `auditFlatEntityChange`) — sem ele, creditaria
 * sempre o autor/editor original, nunca quem de fato excluiu.
 */
const resolveNewsActor = async (data: EntityData, isDelete: boolean): Promise<{ name: string; photoURL: string }> => {
  if (isDelete) {
    const deletedByName = data.deletedByName as string | undefined;
    if (deletedByName) return { name: deletedByName, photoURL: (data.deletedByPhotoURL as string | undefined) ?? '' };
    return getDI().getUserProfileLookupService().resolveActor(
      (data.deletedBy as string | undefined) || (data.userId as string | undefined) || '',
    );
  }
  const editedByName = data.editedByName as string | undefined;
  const authorName = data.authorName as string | undefined;
  if (editedByName) return { name: editedByName, photoURL: '' };
  if (authorName) return { name: authorName, photoURL: (data.authorPhotoURL as string | undefined) ?? '' };
  return getDI().getUserProfileLookupService().resolveActor((data.userId as string | undefined) || '');
};

const resolveNewsActorUid = (data: EntityData, isDelete: boolean): string =>
  (isDelete ? (data.deletedBy as string | undefined) : undefined)
    || (data.userId as string | undefined)
    || '';

/**
 * Notícias, Comentários de Notícias e Etiquetas de Notícias vivem em coleções raiz
 * (`news`, `newsComments`, `newsTags`), fora do padrão `tenants/{tenantId}/...` coberto
 * pelas triggers genéricas — por isso ganham triggers dedicadas aqui.
 */
export const auditNewsChange = onDocumentWritten(
  { document: 'news/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { docId } = event.params;
    let tenantId = 'SYSTEM';
    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const action: AuditAction = !beforeExists ? 'CREATE' : !afterExists ? 'DELETE' : 'UPDATE';
      const beforeData = (before?.data() as EntityData) ?? {};
      const afterData = (after?.data() as EntityData) ?? {};
      const referenceData = action === 'DELETE' ? beforeData : afterData;
      tenantId = (referenceData.tenantId as string | null | undefined) ?? 'SYSTEM';

      // likeCount/likedBy/viewCount/commentCount mudam por curtida, visualização e
      // criação/exclusão de comentário — engajamento, não uma ação administrativa.
      const NOISE_KEYS = ['likeCount', 'likedBy', 'viewCount', 'commentCount'];
      let diff: { before?: EntityData; after?: EntityData } | undefined;
      if (action === 'UPDATE') {
        const fieldDiff = computeChangedFields(beforeData, afterData, NOISE_KEYS);
        if (Object.keys(fieldDiff.after).length === 0) return;
        diff = fieldDiff;
      } else if (action === 'DELETE') {
        diff = { before: normalizeAllFields(beforeData, NOISE_KEYS) };
      }

      const displayName = truncate(asString(referenceData.title, 'Notícia'), 80);
      const severity = resolveSeverity(action, 'news', diff?.after ?? {});
      const actorUid = resolveNewsActorUid(referenceData, action === 'DELETE');
      const actor = await resolveNewsActor(referenceData, action === 'DELETE');

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: `${ACTION_TITLE[action]} na entidade de Notícias`,
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action,
        severity,
        entity: 'News',
        entityId: docId,
        entityLink: `view-news:${docId}`,
        text: buildAuditText(action, 'Notícia', displayName, actor.name, diff),
      });
    } catch (error) {
      await logAuditError(tenantId, 'news', docId, error);
    }
  },
);

export const auditNewsCommentChange = onDocumentWritten(
  { document: 'newsComments/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { docId } = event.params;
    let tenantId = 'SYSTEM';
    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const action: AuditAction = !beforeExists ? 'CREATE' : !afterExists ? 'DELETE' : 'UPDATE';
      const beforeData = (before?.data() as EntityData) ?? {};
      const afterData = (after?.data() as EntityData) ?? {};
      const referenceData = action === 'DELETE' ? beforeData : afterData;
      const newsId = referenceData.newsId as string | undefined;

      // Comentário não guarda tenantId próprio — herda do post pai.
      if (newsId) {
        const newsSnap = await getDb().collection('news').doc(newsId).get();
        tenantId = (newsSnap.data()?.tenantId as string | null | undefined) ?? 'SYSTEM';
      }

      const NOISE_KEYS = ['likeCount', 'likedBy'];
      let diff: { before?: EntityData; after?: EntityData } | undefined;
      if (action === 'UPDATE') {
        const fieldDiff = computeChangedFields(beforeData, afterData, NOISE_KEYS);
        if (Object.keys(fieldDiff.after).length === 0) return;
        diff = fieldDiff;
      } else if (action === 'DELETE') {
        diff = { before: normalizeAllFields(beforeData, NOISE_KEYS) };
      }

      const displayName = truncate(asString(referenceData.content, 'Comentário'), 60);
      const severity = resolveSeverity(action, 'newsComments', diff?.after ?? {});
      const actorUid = resolveNewsActorUid(referenceData, action === 'DELETE');
      const actor = await resolveNewsActor(referenceData, action === 'DELETE');

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: `${ACTION_TITLE[action]} na entidade de Comentários de Notícias`,
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action,
        severity,
        entity: 'NewsComment',
        entityId: docId,
        entityLink: newsId ? `view-news:${newsId}` : undefined,
        text: buildAuditText(action, 'Comentário de Notícia', displayName, actor.name, diff),
      });
    } catch (error) {
      await logAuditError(tenantId, 'newsComments', docId, error);
    }
  },
);

export const auditNewsTagChange = onDocumentWritten(
  { document: 'newsTags/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { docId } = event.params;
    const tenantId = 'SYSTEM';
    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const action: AuditAction = !beforeExists ? 'CREATE' : !afterExists ? 'DELETE' : 'UPDATE';
      const beforeData = (before?.data() as EntityData) ?? {};
      const afterData = (after?.data() as EntityData) ?? {};
      const referenceData = action === 'DELETE' ? beforeData : afterData;

      let diff: { before?: EntityData; after?: EntityData } | undefined;
      if (action === 'UPDATE') {
        const fieldDiff = computeChangedFields(beforeData, afterData);
        if (Object.keys(fieldDiff.after).length === 0) return;
        diff = fieldDiff;
      } else if (action === 'DELETE') {
        diff = { before: normalizeAllFields(beforeData) };
      }

      const displayName = asString(referenceData.name, 'Etiqueta');
      const severity = resolveSeverity(action, 'newsTags', diff?.after ?? {});
      // Etiquetas não denormalizam nome de autor — sempre resolve via lookup. Em DELETE,
      // prefere o uid de quem excluiu (deletedBy) ao uid do criador (userId).
      const actorUid = resolveNewsActorUid(referenceData, action === 'DELETE');
      const actor = await getDI().getUserProfileLookupService().resolveActor(actorUid);

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: `${ACTION_TITLE[action]} na entidade de Etiquetas de Notícias`,
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action,
        severity,
        entity: 'NewsTag',
        entityId: docId,
        text: buildAuditText(action, 'Etiqueta de Notícia', displayName, actor.name, diff),
      });
    } catch (error) {
      await logAuditError(tenantId, 'newsTags', docId, error);
    }
  },
);
