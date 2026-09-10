import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  AGENT_MCP_FUNCTION,
} from '../../domain/schema/agent/agentBackend';
import {
  buildAgentToken,
  generateAgentSecret,
  hashAgentSecret,
} from '../../domain/schema/agent/agentGrant';
import { PERMISSION_AGENT_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { UNRESTRICTED_PERMISSION, grants } from '../../domain/schema/access/memberPermissions';
import { getDI } from '../di/container';
import { grantedPermissions, requirePermission } from './shared/requirePermission';

const REGION = 'southamerica-east1';

/**
 * A configuração pela qual o escritório decide se qualquer membro emite um acesso para si.
 *
 * Padrão LIGADO, e não por leniência: emitir um acesso para si mesmo não concede nada — a interseção
 * garante que ele nunca exceda o que a pessoa já tem, e revogar o perfil dela o estreita na chamada
 * seguinte. Um escritório que ainda assim queira concentrar a emissão desliga isto, e aí ela passa a
 * exigir `agent.manage`.
 *
 * O servidor lê VALOR, nunca declaração: o padrão de verdade vive no manifest da extensão, no
 * cliente, e aqui só a ausência é interpretada — ausente é ligado.
 */
const SELF_SERVICE_SETTING = 'agent.selfServiceGrants';

/** Um ano. Não é política de segurança: é o limite acima do qual ninguém revisa mais nada. */
const MAX_EXPIRY_DAYS = 366;

interface CreateAgentGrantRequest {
  tenantId: string;
  name: string;
  permissions: string[];
  /** Ausente ou nulo = sem expiração. A revogação continua sendo o caminho garantido. */
  expiresInDays?: number | null;
}

interface CreateAgentGrantResponse {
  grantId: string;
  /**
   * O token EM CLARO, e esta é a única vez que ele existe fora da máquina de quem o pediu: o
   * Firestore guarda apenas o hash. Perdido, não há recuperação — emite-se outro.
   */
  token: string;
}

export const createAgentGrant = onCall(
  { region: REGION, cors: true },
  async (request): Promise<CreateAgentGrantResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, name, permissions, expiresInDays } = request.data as CreateAgentGrantRequest;
    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');

    const di = getDI();
    // O mesmo portão do gateway, e pela mesma razão: sem a extensão instalada não há endpoint para
    // usar o token, e emitir um seria entregar uma chave para uma porta que não existe.
    if (!(await di.getInstalledExtensionCache().claimsFunction(tenantId, AGENT_MCP_FUNCTION))) {
      throw new HttpsError('failed-precondition', '@core.access/agent.not-enabled');
    }

    const userId = request.auth.uid;
    const held = await grantedPermissions(tenantId, userId);
    // Frase PRÓPRIA, e não `permission.denied`: aquela interpola `{permission}`, e aqui não há uma —
    // não falta uma permissão específica, falta qualquer uma. Reusá-la mostraria `{permission}` cru.
    if (held.length === 0) throw new HttpsError('permission-denied', '@core.access/agent.nothing-to-grant');

    const settings = await di.getTenantSettingsRepository().getTenantValues(tenantId);
    if (settings[SELF_SERVICE_SETTING] === false) {
      await requirePermission(tenantId, userId, PERMISSION_AGENT_MANAGE);
    }

    const label = typeof name === 'string' ? name.trim() : '';
    if (label === '') throw new HttpsError('invalid-argument', '@core.access/agent.name.required');

    const declared = [...new Set(Array.isArray(permissions) ? permissions : [])]
      .filter((one): one is string => typeof one === 'string' && one.trim() !== '')
      .map((one) => one.trim());
    if (declared.length === 0) {
      throw new HttpsError('invalid-argument', '@core.access/agent.permissions.required');
    }
    // Um teto que se declara irrestrito não é um teto. Quem quer conceder tudo lista tudo, e a lista
    // é o que alguém consegue revisar depois.
    if (declared.includes(UNRESTRICTED_PERMISSION)) {
      throw new HttpsError('invalid-argument', '@core.access/agent.permissions.unrestricted');
    }

    const catalog = await di.getPermissionCatalogCache().get(tenantId);
    for (const permission of declared) {
      // Um id que não existe concederia NADA em silêncio, porque a interseção o descartaria — e quem
      // emitiu ficaria com um acesso que não funciona sem nunca saber que digitou errado.
      if (!catalog.byId.has(permission)) {
        throw new HttpsError('invalid-argument', '@core.access/agent.permission.unknown', { permission });
      }
      // O teto nunca pode ser maior que o de quem emite. A interseção já garantiria isso em execução;
      // recusar aqui é o que faz a tela não oferecer um acesso que nasceria menor do que aparenta.
      if (!grants(held, permission)) {
        throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission });
      }
    }

    const days = typeof expiresInDays === 'number' ? Math.floor(expiresInDays) : null;
    if (days !== null && (days < 1 || days > MAX_EXPIRY_DAYS)) {
      throw new HttpsError('invalid-argument', '@core.access/agent.expiry.invalid');
    }
    const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000);

    const secret = generateAgentSecret();
    const grantId = await di.getAgentGrantRepository().create(tenantId, {
      name: label,
      userId,
      permissions: declared,
      secretHash: await hashAgentSecret(secret),
      expiresAt,
      createdBy: userId,
    });

    const token = buildAgentToken({ tenantId, grantId, secret });
    if (token === null) {
      // Só aconteceria com um id fora do padrão de identificador do Firestore. Um token que não se
      // consegue MONTAR não pode ser devolvido pela metade, e o acesso já gravado é inútil sem ele.
      await di.getAgentGrantRepository().revoke(tenantId, grantId, userId);
      throw new HttpsError('internal', '@core.access/agent.token.failed');
    }

    return { grantId, token };
  },
);
