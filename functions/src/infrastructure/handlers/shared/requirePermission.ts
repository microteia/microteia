import { HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../../di/container';
import { UNRESTRICTED_PERMISSION, grants, grantsAny } from '../../../domain/schema/access';

/**
 * A mesma pergunta que as Security Rules fazem, do lado das callables.
 *
 * Ela lê o conjunto MATERIALIZADO no documento de membro, e não os perfis: resolver dependência a
 * cada chamada custaria ler o catálogo inteiro do escritório para responder um booleano. O
 * administrador global (`SYSTEM`) passa por cima, como em todo o resto do produto.
 */
const isSystemAdmin = async (userId: string): Promise<boolean> =>
  (await getDI().getUserRepository().getUserRole(userId)) === 'SYSTEM';

/**
 * Devolve o conjunto CONCEDIDO, e não `void`: quem acabou de autorizar quase sempre precisa dele em
 * seguida para montar o ator da execução (`WorkflowContext.actor`), e uma segunda leitura do mesmo
 * documento seria só desperdício. O administrador global recebe o curinga, que é o que ele de fato
 * tem.
 */
export const requirePermission = async (
  tenantId: string,
  userId: string,
  permission: string,
): Promise<string[]> => {
  const granted = await getDI().getTenantMemberRepository().getMemberPermissions(tenantId, userId);
  if (grants(granted, permission)) return granted;
  if (await isSystemAdmin(userId)) return [UNRESTRICTED_PERMISSION];
  throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission });
};

/** Basta UMA das permissões. Serve à callable que atende a mais de um gesto da tela. */
export const requireAnyPermission = async (
  tenantId: string,
  userId: string,
  permissions: string[],
): Promise<void> => {
  const granted = await getDI().getTenantMemberRepository().getMemberPermissions(tenantId, userId);
  if (grantsAny(granted, permissions)) return;
  if (await isSystemAdmin(userId)) return;
  throw new HttpsError('permission-denied', '@core.access/permission.denied', {
    permission: permissions.join(', '),
  });
};
