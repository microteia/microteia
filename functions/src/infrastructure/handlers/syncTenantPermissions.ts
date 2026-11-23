import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { KERNEL_CATALOG_FINGERPRINT } from '../../domain/schema/access';
import { planStamp } from '../../domain/schema/plans';
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
 *
 * **O plano também acorda isto** (#24). A troca de plano e a mudança do teto de um plano têm gatilho
 * próprio, mas o do plano recompõe N escritórios numa invocação só, e uma falha no meio deixaria
 * alguns com o teto velho sem sintoma. A digital do que o plano nega cobre esse caso pelo mesmo
 * caminho do catálogo: o navegador compara, e o primeiro membro que abrir o app cura o escritório.
 */
const wantedPlanStamp = async (tenantId: string): Promise<string> => {
  const planId = (await getDI().getTenantRepository().getById(tenantId))?.plan;
  const plan = planId ? await getDI().getPlanRepository().getPlan(planId) : null;
  return planStamp(plan?.deniedPermissions ?? []);
};

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
    const [stamps, wantedPlan] = await Promise.all([
      getDI().getTenantMemberRepository().getMemberStamps(tenantId, uid),
      wantedPlanStamp(tenantId),
    ]);
    if (stamps.catalog === KERNEL_CATALOG_FINGERPRINT && stamps.plan === wantedPlan) return { updated: 0 };

    if (!(await isOfficeMember(tenantId, request.auth))) {
      throw new HttpsError('permission-denied', '@core.access/permission.denied', {
        permission: 'members',
      });
    }

    getDI().getPermissionCatalogCache().invalidate(tenantId);
    const updated = await getDI().getMaterializeMemberPermissionsUseCase().execute({ tenantId });
    return { updated };
  },
);
