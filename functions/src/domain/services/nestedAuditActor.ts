import type { AuditAction } from '../entities/AuditLog';

export interface NestedAuditActor {
  uid: string;
  /** O nome gravado junto com o gesto, quando o gesto o gravou; sem ele, quem chama resolve pelo uid. */
  name?: string;
  photoURL?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const sharedOf = (data: Record<string, unknown>): boolean => data.portalShared === true;

/**
 * QUEM fez o que a linha de auditoria de uma nota ou de um documento registra.
 *
 * A autoria do anexo (`createdBy`) só responde pela inclusão. Compartilhar com o portal é outro gesto,
 * de outra pessoa, ou da automação, e é ele que a linha registra: `portalSharedBy`. Atribuí-lo a quem
 * anexou dizia, na prova, que foi o autor do arquivo quem o expôs ao convidado.
 */
export const nestedAuditActor = (
  action: AuditAction,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): NestedAuditActor => {
  if (action === 'DELETE') {
    const uid = text(before.deletedBy) || text(before.createdBy);
    const name = text(before.deletedByName);
    return name ? { uid, name, photoURL: text(before.deletedByPhotoURL) } : { uid };
  }
  if (action === 'UPDATE' && sharedOf(before) !== sharedOf(after) && text(after.portalSharedBy)) {
    return { uid: text(after.portalSharedBy) };
  }
  const uid = text(after.createdBy);
  const name = text(after.createdByName);
  return name ? { uid, name, photoURL: text(after.createdByPhotoUrl) } : { uid };
};
