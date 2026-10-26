import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_PORTAL_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { domainErrorCode } from '../../domain/errors/DomainError';

const REGION = 'southamerica-east1';

const requireString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new HttpsError('invalid-argument', message);
  return value.trim();
};

const optionalString = (value: unknown): string | null =>
  (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** A recusa prevista volta como está; a imprevista vai para o log com a pilha, e a pessoa lê a frase genérica. */
const asHttpsError = (error: unknown, operation: string): HttpsError => {
  if (error instanceof HttpsError) return error;
  const code = domainErrorCode(error);
  if (!code) {
    logger.error(`[portal] ${operation} falhou: ${error instanceof Error ? error.message : String(error)}`, {
      operation,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new HttpsError('internal', '@core.tenant/portal.signin.identity-failed');
  }
  return new HttpsError(code, error instanceof Error ? error.message : '@core.tenant/portal.signin.identity-failed');
};

/**
 * Os métodos de entrada do portal de um escritório — o que a página de entrada mostra ANTES de haver
 * sessão. Por isso não pede login: devolve só os rótulos dos botões e se o link de e-mail vale.
 */
export const getPortalSignInOptions = onCall({ region: REGION, cors: true }, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  try {
    return await getDI().getPortalSignInOptionsUseCase().execute(tenantId);
  } catch (error) {
    throw asHttpsError(error, 'getPortalSignInOptions');
  }
});

/**
 * A ida ao provedor. Sem login, por natureza: é o login. O que protege é o resto do fluxo — o pedido
 * guardado só pelo hash do `state`, o PKCE cujo verificador nunca sai do servidor, e a volta que só
 * vale uma vez.
 */
export const startPortalSignIn = onCall({ region: REGION, cors: true }, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  try {
    return await getDI().getStartPortalSignInUseCase().execute({
      tenantId: requireString(data.tenantId, '@core.automation/handler.tenant.missing'),
      providerId: requireString(data.providerId, '@core.tenant/portal.signin.provider-unavailable'),
      redirectUri: requireString(data.redirectUri, '@core.tenant/portal.signin.redirect-invalid'),
      next: optionalString(data.next),
      inviteId: optionalString(data.inviteId),
    });
  } catch (error) {
    throw asHttpsError(error, 'startPortalSignIn');
  }
});

/**
 * A volta do provedor: troca o código, confere o ID token, acha os convites que a identidade satisfaz
 * e devolve o token que abre a sessão da conta do convidado NESTE escritório.
 */
export const completePortalSignIn = onCall({ region: REGION, cors: true }, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const state = requireString(data.state, '@core.tenant/portal.signin.expired');
  const code = requireString(data.code, '@core.tenant/portal.signin.identity-failed');
  try {
    return await getDI()
      .getCompletePortalSignInUseCase((message, detail) => logger.warn(message, detail))
      .execute({ state, code });
  } catch (error) {
    throw asHttpsError(error, 'completePortalSignIn');
  }
});

/**
 * Configurações › Portal › Entrada — a única porta da configuração e dos segredos dos clientes OIDC.
 * `get` devolve SE o segredo existe, nunca qual é. Cobra `portal.manage`: decidir como alguém de fora
 * prova quem é faz parte de decidir o que sai do escritório.
 */
export const managePortalSignIn = onCall({ region: REGION, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const userId = request.auth.uid;
  await requirePermission(tenantId, userId, PERMISSION_PORTAL_MANAGE);
  const manage = getDI().getManagePortalSignInUseCase();
  try {
    if (data.op === 'get') return await manage.get(tenantId);
    if (data.op === 'save') {
      const raw = typeof data.secrets === 'object' && data.secrets !== null ? (data.secrets as Record<string, unknown>) : {};
      const secrets = Object.fromEntries(Object.entries(raw)
        .filter((entry): entry is [string, string | null] => typeof entry[1] === 'string' || entry[1] === null));
      return await manage.save({ tenantId, userId, settings: data.settings, secrets });
    }
    throw new HttpsError('invalid-argument', '@core.tenant/portal.identity.op-invalid');
  } catch (error) {
    throw asHttpsError(error, 'managePortalSignIn');
  }
});
