import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { KERNEL_CATALOG_FINGERPRINT } from '../../domain/schema/access';
import { isOfficeMember } from './shared/requirePermission';

/**
 * Recompõe as permissões efetivas do escritório quando o CATÁLOGO DE CÓDIGO mudou.
 *
 * Os gatilhos do Firestore cobrem o que muda no BANCO — perfil, membro, tela, extensão. Eles não
 * cobrem o que muda no CÓDIGO: uma versão nova do kernel pode alterar a dependência de uma permissão
 * (foi o que aconteceu quando criar, editar e excluir passaram a exigir ver), e nenhuma escrita
 * acontece para acordá-los.
 *
 * **Quem chama é o próprio app, não uma pessoa.** Isto já foi um botão em Configurações, e o botão
 * era a forma errada: ele exigia que alguém no escritório soubesse que houve upgrade de kernel, que
 * o upgrade mexeu numa dependência, e que a consequência disso era um botão numa aba de perfis.
 * Ninguém sabe as três coisas — e o sintoma é silencioso, porque a tela recalcula sozinha e só as
 * Security Rules ficam velhas. O front compara a digital carimbada no membro com a do código e chama
 * isto quando elas divergem; o primeiro que abrir o app depois do upgrade cura o escritório inteiro.
 *
 * **Não pede permissão, pede pertencimento** — e é deliberado. Quem está com o conjunto velho é
 * justamente quem pode não ter `roles.manage`, e exigir a permissão deixaria de fora o caso que a
 * função existe para atender. A operação não concede nada: recompõe o que os perfis já declaram, e
 * a guarda de digital abaixo faz de uma chamada repetida uma leitura só.
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

    const uid = request.auth.uid;
    const stamp = await getDI().getTenantMemberRepository().getMemberCatalogStamp(tenantId, uid);
    if (stamp === KERNEL_CATALOG_FINGERPRINT) return { updated: 0 };

    if (!(await isOfficeMember(tenantId, uid))) {
      throw new HttpsError('permission-denied', '@core.access/permission.denied', {
        permission: 'members',
      });
    }

    getDI().getPermissionCatalogCache().invalidate(tenantId);
    const updated = await getDI().getMaterializeMemberPermissionsUseCase().execute({ tenantId });
    return { updated };
  },
);
