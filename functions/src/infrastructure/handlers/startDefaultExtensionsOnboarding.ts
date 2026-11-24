import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { domainErrorCode, DomainError } from '../../domain/errors/DomainError';
import { requireMemberSession } from './shared/requirePermission';

/**
 * O portão das extensões padrão chama isto antes da primeira instalação de um escritório novo (#28): abre
 * a janela em que o teto do plano não vale para o dono. Ver `StartDefaultExtensionsOnboardingUseCase`.
 */
export const startDefaultExtensionsOnboarding = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ windowEndsAt: number | null }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId } = (request.data ?? {}) as { tenantId?: unknown };
    if (typeof tenantId !== 'string' || tenantId === '') {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }
    try {
      await requireMemberSession(tenantId, request.auth);
      return await getDI().getStartDefaultExtensionsOnboardingUseCase().execute({ tenantId, userId: request.auth.uid });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      const code = domainErrorCode(error);
      if (code) throw new HttpsError(code, (error as DomainError).message, (error as DomainError).params);
      logger.error(`[startDefaultExtensionsOnboarding] failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpsError('internal', '@core.marketplace/default.onboarding.start-failed');
    }
  },
);
