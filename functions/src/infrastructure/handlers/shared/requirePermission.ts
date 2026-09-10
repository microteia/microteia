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
 * O DONO do escritório, lido do próprio escritório — a mesma frase que o `firestore.rules` diz.
 *
 * Ele é consultado só depois de a permissão materializada já ter falhado, e por isso não custa nada
 * a quem tem acesso. Precisa existir porque o dono não pode depender de a materialização já ter
 * rodado: as regras o deixavam passar e a callable não, o que dava duas respostas à mesma pergunta.
 */
const isTenantOwner = async (tenantId: string, userId: string): Promise<boolean> =>
  (await getDI().getTenantRepository().getById(tenantId))?.ownerId === userId;

/**
 * O conjunto concedido, SEM exigir permissão nenhuma — e sem lançar.
 *
 * `requirePermission` responde "pode fazer X?"; esta responde "o que pode?". A diferença importa para
 * quem precisa do conjunto ANTES de saber o que vai perguntar: o acesso de agente cruza este conjunto
 * com o teto declarado no token, e a pergunta concreta só aparece depois, uma por operação.
 *
 * Ela mora aqui, e reusa as duas frases privadas acima, porque são as MESMAS três regras que decidem
 * quem entra num escritório — membro, dono, SYSTEM. Escrevê-las de novo do lado do agente seria a
 * quarta cópia, e ela divergiria justamente onde não se pode divergir.
 *
 * Vazio é a resposta de quem não é membro: a ausência não concede nada.
 */
export const grantedPermissions = async (tenantId: string, userId: string): Promise<string[]> => {
  if (await isSystemAdmin(userId)) return [UNRESTRICTED_PERMISSION];
  if (await isTenantOwner(tenantId, userId)) return [UNRESTRICTED_PERMISSION];
  return getDI().getTenantMemberRepository().getMemberPermissions(tenantId, userId);
};

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
  if (await isTenantOwner(tenantId, userId)) return [UNRESTRICTED_PERMISSION];
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
  if (await isTenantOwner(tenantId, userId)) return;
  throw new HttpsError('permission-denied', '@core.access/permission.denied', {
    permission: permissions.join(', '),
  });
};

/**
 * "Este usuário pode agir NESTE escritório?" — a pergunta sem permissão nenhuma no meio.
 *
 * Ela mora aqui, e não na superfície de servidor das extensões, para não haver uma segunda
 * implementação de membro/dono/SYSTEM: são as MESMAS três frases que `requirePermission` diz e que o
 * `firestore.rules` diz, e uma quarta cópia divergiria justamente na regra que decide quem entra.
 *
 * O conjunto de permissões vazio é a resposta de quem não é membro — é assim que o documento de membro
 * responde por ausência —, então a leitura é a mesma que `requirePermission` já faz.
 */
export const isOfficeMember = async (tenantId: string, userId: string): Promise<boolean> => {
  const granted = await getDI().getTenantMemberRepository().getMemberPermissions(tenantId, userId);
  if (granted.length > 0) return true;
  if (await isSystemAdmin(userId)) return true;
  return isTenantOwner(tenantId, userId);
};
