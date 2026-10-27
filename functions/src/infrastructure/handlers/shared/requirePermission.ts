import { HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../../di/container';
import { UNRESTRICTED_PERMISSION, grants, grantsAny } from '../../../domain/schema/access';
import { mfaSessionIssue, mfaVerifiedAtOf } from '../../../domain/schema/memberMfa';
import type { MfaSessionIssue } from '../../../domain/schema/memberMfa';
import type { MemberAccess } from '../../../domain/repositories/ITenantMemberRepository';

/**
 * Quem chama uma callable: o uid e as claims da SESSÃO. As claims são o que diz se esta sessão provou o
 * segundo fator que o escritório exige — e por isso o tipo não aceita só o uid: uma checagem que
 * esquecesse o token deixaria passar justamente a sessão aberta só com a senha. `request.auth` de todo
 * `onCall` já tem esta forma.
 */
export interface CallerAuth {
  uid: string;
  token: Record<string, unknown>;
}

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
 * A sessão prova o segundo fator que o escritório exige deste membro, e há pouco o bastante para AGIR —
 * a mesma conta de `sessionSatisfiesMfa` no `firestore.rules`. Toda callable é tratada como agir: é por
 * elas que passam as gravações do Admin SDK, que as regras não veem.
 *
 * O `SYSTEM` não é alcançado por política de escritório, como nas regras (`isSystemAdmin()` é o primeiro
 * termo de `can`). Ele só é consultado quando a sessão falharia, para não custar leitura a ninguém mais.
 */
const SESSION_REFUSAL: Record<MfaSessionIssue, string> = {
  missing: '@core.access/mfa.session.missing',
  expired: '@core.access/mfa.session.expired',
};

const assertMemberSession = async (access: MemberAccess, caller: CallerAuth): Promise<void> => {
  const issue = mfaSessionIssue(access.mfa, mfaVerifiedAtOf(caller.token), Math.floor(Date.now() / 1000), true);
  if (issue === null || await isSystemAdmin(caller.uid)) return;
  throw new HttpsError('permission-denied', SESSION_REFUSAL[issue], { secondFactor: issue });
};

const accessOf = (tenantId: string, userId: string): Promise<MemberAccess | null> =>
  getDI().getTenantMemberRepository().getMemberAccess(tenantId, userId);

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
 * Vazio é a resposta de quem não é membro: a ausência não concede nada. Não olha sessão nenhuma: quem a
 * chama é o agente, que se autentica pelo PRÓPRIO token — emitido por quem provou o fator ao emiti-lo.
 */
export const grantedPermissions = async (tenantId: string, userId: string): Promise<string[]> => {
  if (await isSystemAdmin(userId)) return [UNRESTRICTED_PERMISSION];
  if (await isTenantOwner(tenantId, userId)) return [UNRESTRICTED_PERMISSION];
  return getDI().getTenantMemberRepository().getMemberPermissions(tenantId, userId);
};

/**
 * Só a sessão, sem permissão nenhuma no meio — para a callable que autoriza por outro caminho (um caso
 * de uso que cobra a permissão por conta própria) e ainda assim age no escritório.
 */
export const requireMemberSession = async (tenantId: string, caller: CallerAuth): Promise<void> => {
  const access = await accessOf(tenantId, caller.uid);
  if (access) await assertMemberSession(access, caller);
};

/**
 * Devolve o conjunto CONCEDIDO, e não `void`: quem acabou de autorizar quase sempre precisa dele em
 * seguida para montar o ator da execução (`WorkflowContext.actor`), e uma segunda leitura do mesmo
 * documento seria só desperdício. O administrador global recebe o curinga, que é o que ele de fato
 * tem.
 */
export const requirePermission = async (
  tenantId: string,
  caller: CallerAuth,
  permission: string,
): Promise<string[]> => {
  const access = await accessOf(tenantId, caller.uid);
  if (access && grants(access.permissions, permission)) {
    await assertMemberSession(access, caller);
    return access.permissions;
  }
  if (await isSystemAdmin(caller.uid)) return [UNRESTRICTED_PERMISSION];
  if (await isTenantOwner(tenantId, caller.uid)) {
    if (access) await assertMemberSession(access, caller);
    return [UNRESTRICTED_PERMISSION];
  }
  throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission });
};

/** Basta UMA das permissões. Serve à callable que atende a mais de um gesto da tela. */
export const requireAnyPermission = async (
  tenantId: string,
  caller: CallerAuth,
  permissions: string[],
): Promise<void> => {
  const access = await accessOf(tenantId, caller.uid);
  if (access && grantsAny(access.permissions, permissions)) {
    await assertMemberSession(access, caller);
    return;
  }
  if (await isSystemAdmin(caller.uid)) return;
  if (await isTenantOwner(tenantId, caller.uid)) {
    if (access) await assertMemberSession(access, caller);
    return;
  }
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
 * responde por ausência —, então a leitura é a mesma que `requirePermission` já faz. O membro cuja sessão
 * não provou o segundo fator é RECUSADO com o motivo, e não respondido com `false`: "não é membro" o
 * mandaria pedir acesso, quando o que falta é o código.
 */
export const isOfficeMember = async (tenantId: string, caller: CallerAuth): Promise<boolean> => {
  const access = await accessOf(tenantId, caller.uid);
  if (access && access.permissions.length > 0) {
    await assertMemberSession(access, caller);
    return true;
  }
  if (await isSystemAdmin(caller.uid)) return true;
  if (!(await isTenantOwner(tenantId, caller.uid))) return false;
  if (access) await assertMemberSession(access, caller);
  return true;
};
