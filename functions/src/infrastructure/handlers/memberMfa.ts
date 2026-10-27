import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_MFA_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { mfaVerifiedAtOf } from '../../domain/schema/memberMfa';
import { domainErrorCode, DomainError } from '../../domain/errors/DomainError';
import type { MfaActor } from '../../domain/usecases/MemberMfaUseCases';

const REGION = 'southamerica-east1';

/**
 * O erro de domínio vira `HttpsError` com os parâmetros em `details`, que é onde o cliente os procura. O
 * que não é de domínio vira `internal` e vai para o log — inclusive a falha de ASSINAR a sessão, que é o
 * sintoma de uma instalação sem `iam.serviceAccounts.signBlob` e merece aparecer no log com o nome dela.
 */
const asHttpsError = (error: unknown, operation: string): HttpsError => {
  if (error instanceof HttpsError) return error;
  const code = domainErrorCode(error);
  if (!code) {
    logger.error(`[mfa] ${operation} failed: ${error instanceof Error ? error.message : String(error)}`, {
      operation,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new HttpsError('internal', '@core.access/mfa.failed');
  }
  return new HttpsError(code, (error as DomainError).message, (error as DomainError).params);
};

const tenantOf = (data: Record<string, unknown>): string => {
  if (typeof data.tenantId !== 'string' || data.tenantId.trim() === '') {
    throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
  }
  return data.tenantId.trim();
};

const actorOf = async (userId: string): Promise<MfaActor> => {
  const resolved = await getDI().getUserProfileLookupService().resolveActor(userId);
  return { userId, userName: resolved.name, photoURL: resolved.photoURL };
};

/**
 * A porta da PESSOA para o próprio segundo fator. Não pede permissão nem sessão provada — é por aqui que
 * passa quem ainda não pode nada. O caso de uso exige só que ela pertença ao escritório, onde a prova
 * vai ser usada e auditada. O limite de tentativas mora no fator, numa transação, e não aqui.
 */
export const secondFactor = onCall({ region: REGION, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = tenantOf(data);
  const userId = request.auth.uid;
  const sessionVerifiedAt = mfaVerifiedAtOf(request.auth.token);
  const useCase = getDI().getSecondFactorUseCase();

  try {
    if (data.op === 'status') return await useCase.status({ tenantId, userId });
    const actor = await actorOf(userId);
    if (data.op === 'enroll') {
      return await useCase.enroll({
        tenantId,
        actor,
        account: request.auth.token.email ?? userId,
        issuer: data.issuer,
        sessionVerifiedAt,
      });
    }
    if (data.op === 'confirm') return await useCase.confirm({ tenantId, actor, code: data.code });
    if (data.op === 'verify') return await useCase.verify({ tenantId, actor, code: data.code });
    if (data.op === 'recovery-codes') return await useCase.regenerateRecoveryCodes({ tenantId, actor, sessionVerifiedAt });
    throw new HttpsError('invalid-argument', '@core.access/mfa.op-invalid');
  } catch (error) {
    throw asHttpsError(error, `secondFactor:${String(data.op)}`);
  }
});

/**
 * A porta do ESCRITÓRIO: a política e o fator de quem perdeu o celular, com `mfa.manage` — e, como toda
 * callable, com a sessão provada se a política alcança quem chama. O administrador global não é
 * alcançado por política de escritório e é o único que zera o fator de quem participa de mais de um.
 */
export const manageMemberMfa = onCall({ region: REGION, cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = tenantOf(data);
  const userId = request.auth.uid;
  await requirePermission(tenantId, request.auth, PERMISSION_MFA_MANAGE);

  const di = getDI();
  const useCase = di.getManageMemberMfaUseCase();
  try {
    if (data.op === 'overview') return await useCase.overview(tenantId);
    const actorIsSystem = (await di.getUserRepository().getUserRole(userId)) === 'SYSTEM';
    const actor = await actorOf(userId);
    if (data.op === 'save') {
      return await useCase.save({
        tenantId,
        actor,
        actorAccess: actorIsSystem ? null : await di.getTenantMemberRepository().getMemberAccess(tenantId, userId),
        actorVerifiedAt: mfaVerifiedAtOf(request.auth.token),
        policy: data.policy,
      });
    }
    if (data.op === 'reset') return await useCase.reset({ tenantId, actor, actorIsSystem, userId: data.userId });
    throw new HttpsError('invalid-argument', '@core.access/mfa.op-invalid');
  } catch (error) {
    throw asHttpsError(error, `manageMemberMfa:${String(data.op)}`);
  }
});
