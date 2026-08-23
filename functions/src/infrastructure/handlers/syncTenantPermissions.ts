import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { PERMISSION_ROLES_MANAGE } from '../../domain/schema/access';
import { requirePermission } from './shared/requirePermission';

/**
 * Recalcula as permissões efetivas de TODOS os membros do escritório, sob demanda.
 *
 * Os gatilhos do Firestore cobrem o que muda no BANCO — perfil, membro, tela, extensão. Eles não
 * cobrem o que muda no CÓDIGO: uma versão nova do kernel pode alterar a dependência de uma
 * permissão (foi o que aconteceu quando criar, editar e excluir passaram a exigir ver), e nenhuma
 * escrita acontece para acordá-los. Sem esta porta, o escritório ficaria com o conjunto antigo até
 * alguém salvar um perfil por acaso.
 *
 * É idempotente pela mesma razão que a rotina é: ela não grava onde o resultado não muda.
 */
export const syncTenantPermissions = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ updated: number }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId } = request.data as { tenantId?: string };
    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }

    // O DONO do escritório passa mesmo sem permissão materializada — é o caso em que esta função
    // mais serve, porque é justamente ele quem chega a um escritório ainda sem nada calculado.
    const tenant = await getDI().getTenantRepository().getById(tenantId);
    if (tenant?.ownerId !== request.auth.uid) {
      await requirePermission(tenantId, request.auth.uid, PERMISSION_ROLES_MANAGE);
    }

    getDI().getPermissionCatalogCache().invalidate(tenantId);
    const updated = await getDI().getMaterializeMemberPermissionsUseCase().execute({ tenantId });
    return { updated };
  },
);
