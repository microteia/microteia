import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { Change, FirestoreEvent } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { getDI } from '../di/container';

const REGION = 'southamerica-east1';

type WriteEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, { tenantId: string }>;

const list = (snapshot: DocumentSnapshot | undefined, field: string): string[] | null => {
  if (!snapshot?.exists) return null;
  const value = snapshot.data()?.[field];
  return Array.isArray(value) ? (value as string[]) : null;
};

const sameList = (a: string[] | null, b: string[] | null): boolean =>
  a !== null && b !== null && a.length === b.length && a.every((value, index) => value === b[index]);

const rebuild = async (tenantId: string, userIds?: string[]): Promise<void> => {
  const di = getDI();
  di.getPermissionCatalogCache().invalidate(tenantId);
  await di.getMaterializeMemberPermissionsUseCase().execute({ tenantId, ...(userIds ? { userIds } : {}) });
};

/**
 * O gatilho do MEMBRO só recalcula quando os perfis dele mudam (ou quando o documento nasce).
 *
 * A guarda não é economia: a rotina grava `permissions` NESTE documento, o que dispara este mesmo
 * gatilho. Sem ela haveria uma segunda invocação a cada escrita — que não gravaria nada, mas custaria
 * uma leitura do escritório inteiro.
 */
export const materializePermissionsOnMemberChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/members/{userId}', region: REGION },
  async (event: WriteEvent) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;

    const rolesUnchanged = sameList(list(before, 'roleIds'), list(after, 'roleIds'));
    const alreadyMaterialized = list(after, 'permissions') !== null;
    if (rolesUnchanged && alreadyMaterialized) return;

    const userId = (after.data()?.userId as string | undefined) ?? after.id;
    await rebuild(event.params.tenantId, [userId]);
  },
);

/** Mudou o perfil: recalcula o escritório inteiro — quem o tinha e quem acabou de perdê-lo. */
export const materializePermissionsOnRoleChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/roles/{roleId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);

/**
 * Mudou o CATÁLOGO — uma tela criada no Form Design, uma extensão instalada ou desligada.
 *
 * Recalcular aqui é o que dispensa gravar as dependências dentro do perfil: o perfil continua com o
 * que o administrador marcou, e o que ele arrasta é recomposto no dia em que a declaração mudar.
 */
export const materializePermissionsOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);

export const materializePermissionsOnExtensionChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/installed_extensions/{extensionId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);
