import type { EntityMetadata } from '../schema/entityRegistry';
import type { ChildRecordKind } from '../schema/eventCatalog';
import { childRecordEventName } from '../schema/eventCatalog';
import { RECORD_DOCUMENT_SERVER_STAMPS } from './recordDocumentHash';

export interface ChildRecordWrite {
  kind: ChildRecordKind;
  /** O prefixo de evento do registro PAI — o que a tela dele declara, ou a coleção. */
  parentPrefix: string;
  parentId: string;
  childId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** O registro pai como está agora; `null` quando ele não existe mais. */
  parentData: Record<string, unknown> | null;
  /** A entidade do pai, de onde saem os campos que dão nome a ele no evento. */
  parentEntity: EntityMetadata | undefined;
}

export interface ChildRecordEvent {
  name: string;
  payload: Record<string, unknown>;
}

const withoutServerStamps = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !RECORD_DOCUMENT_SERVER_STAMPS.includes(key)));

/**
 * O evento de uma nota ou de um documento de registro — `<prefixo>_note.saved`, por exemplo.
 *
 * Vale para QUALQUER tela: o nome sai do prefixo da tela do pai, e os campos do pai que o evento
 * carrega são os que dão nome ao registro (`referenceDenormFields`), os mesmos que o catálogo de
 * eventos oferece em `parent.*`. Nada aqui conhece coleção pelo nome.
 *
 * `null` quando não há o que publicar: escrita que não mudou nada — ou que só acrescentou o que o
 * servidor carimba depois (o hash do anexo), que já foi no evento da criação.
 */
export const childRecordEvent = (write: ChildRecordWrite): ChildRecordEvent | null => {
  const { before, after } = write;
  if (!before && !after) return null;
  if (before && after && JSON.stringify(withoutServerStamps(before)) === JSON.stringify(withoutServerStamps(after))) {
    return null;
  }

  const isDelete = !!before && !after;
  const payload: Record<string, unknown> = {
    id: write.childId,
    parentId: write.parentId,
    parentType: write.parentPrefix,
  };
  if (!isDelete) payload.changeType = before ? 'updated' : 'created';
  if (!isDelete && before) payload.old = before;
  Object.assign(payload, isDelete ? before : after);

  const parent: Record<string, unknown> = { id: write.parentId };
  if (write.parentData) {
    for (const field of write.parentEntity?.referenceDenormFields ?? []) {
      if (write.parentData[field] !== undefined) parent[field] = write.parentData[field];
    }
  }
  payload.parent = parent;

  return {
    name: childRecordEventName(write.parentPrefix, write.kind, isDelete ? 'deleted' : 'saved'),
    payload,
  };
};
