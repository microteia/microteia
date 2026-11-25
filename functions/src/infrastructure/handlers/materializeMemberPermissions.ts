import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { Change, FirestoreEvent } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { getDI } from '../di/container';
import { planDefinitionOf, planStamp } from '../../domain/schema/plans';
import { defaultExtensionsOnboardingOf } from '../../domain/schema/plugin/defaultExtensions';

const REGION = 'southamerica-east1';

type WriteEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, { tenantId: string }>;

const list = (snapshot: DocumentSnapshot | undefined, field: string): string[] | null => {
  if (!snapshot?.exists) return null;
  const value = snapshot.data()?.[field];
  return Array.isArray(value) ? (value as string[]) : null;
};

const sameList = (a: string[] | null, b: string[] | null): boolean =>
  a !== null && b !== null && a.length === b.length && a.every((value, index) => value === b[index]);

const rebuild = async (tenantId: string, userIds?: string[]): Promise<void> => {
  const di = getDI();
  di.getPermissionCatalogCache().invalidate(tenantId);
  await di.getMaterializeMemberPermissionsUseCase().execute({ tenantId, ...(userIds ? { userIds } : {}) });
};

/**
 * O gatilho do MEMBRO só recalcula quando os perfis dele mudam (ou quando o documento nasce).
 *
 * A guarda não é economia: a rotina grava `permissions` NESTE documento, o que dispara este mesmo
 * gatilho. Sem ela haveria uma segunda invocação a cada escrita — que não gravaria nada, mas custaria
 * uma leitura do escritório inteiro.
 */
export const materializePermissionsOnMemberChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/members/{userId}', region: REGION },
  async (event: WriteEvent) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;

    const rolesUnchanged = sameList(list(before, 'roleIds'), list(after, 'roleIds'));
    const alreadyMaterialized = list(after, 'permissions') !== null;
    if (rolesUnchanged && alreadyMaterialized) return;

    const userId = (after.data()?.userId as string | undefined) ?? after.id;
    await rebuild(event.params.tenantId, [userId]);
  },
);

/** Mudou o perfil: recalcula o escritório inteiro — quem o tinha e quem acabou de perdê-lo. */
export const materializePermissionsOnRoleChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/roles/{roleId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);

/**
 * Mudou o CATÁLOGO — uma tela criada no Form Design, uma extensão instalada ou desligada.
 *
 * Recalcular aqui é o que dispensa gravar as dependências dentro do perfil: o perfil continua com o
 * que o administrador marcou, e o que ele arrasta é recomposto no dia em que a declaração mudar.
 */
export const materializePermissionsOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);

export const materializePermissionsOnExtensionChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/installed_extensions/{extensionId}', region: REGION },
  async (event: WriteEvent) => {
    await rebuild(event.params.tenantId);
  },
);

/**
 * O escritório trocou de PLANO (#24): o teto mudou para todos os membros dele.
 *
 * Só a troca acorda a recomposição. O documento do escritório muda por muitos motivos — nome, logo,
 * contador de membros a cada entrada —, e recompor o escritório inteiro a cada um seria pagar a
 * leitura de todos os membros por nada.
 */
export const materializePermissionsOnTenantPlanChange = onDocumentWritten(
  { document: 'tenants/{tenantId}', region: REGION },
  async (event: WriteEvent) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    if (event.data?.before?.data()?.plan === after.data()?.plan) return;
    await rebuild(event.params.tenantId);
  },
);

type PlanWriteEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, { planId: string }>;

const deniedStampOf = (snapshot: DocumentSnapshot | undefined): string =>
  snapshot?.exists ? planStamp(planDefinitionOf(snapshot.id, snapshot.data()).deniedPermissions) : '';

/**
 * O teto de um PLANO mudou: vale na hora para todos os escritórios que estão nele (#24).
 *
 * Renomear, arquivar ou mudar o limite padrão não muda o teto, e não acorda nada — o limite é copiado
 * para o escritório só quando ele nasce ou troca de plano. Excluir o plano conta como deixar de negar:
 * o escritório que ainda apontasse para ele fica sem restrição, como o escritório sem plano.
 *
 * Os escritórios são recompostos um a um, de propósito: em paralelo, um plano popular abriria centenas
 * de leituras de escritório inteiro ao mesmo tempo. O que falhar no meio não fica para sempre: a
 * digital do plano no membro diverge, e o navegador pede a recomposição (`syncTenantPermissions`).
 */
export const materializePermissionsOnPlanChange = onDocumentWritten(
  { document: 'plans/{planId}', region: REGION, timeoutSeconds: 540 },
  async (event: PlanWriteEvent) => {
    if (deniedStampOf(event.data?.before) === deniedStampOf(event.data?.after)) return;
    const tenantIds = await getDI().getPlanRepository().tenantIdsOnPlan(event.params.planId);
    for (const tenantId of tenantIds) {
      try {
        await rebuild(tenantId);
      } catch (cause) {
        console.error('[materializePermissionsOnPlanChange]', tenantId, cause);
      }
    }
  },
);

type OnboardingWriteEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, { tenantId: string; documentId: string }>;

/** O que, na lista de instalação, decide a janela do teto: ainda há pendente, e quando o dono começou. */
const onboardingWindowKey = (snapshot: DocumentSnapshot | undefined): string => {
  if (!snapshot?.exists) return '';
  const onboarding = defaultExtensionsOnboardingOf(snapshot.data());
  return `${onboarding.pending.length > 0}:${onboarding.startedAt ?? ''}`;
};

/**
 * A janela de instalação das extensões padrão abriu ou fechou (#28). Fechar é o que importa: a lista
 * esvaziou, e o teto do plano tem de valer para o dono na hora — não só quando o prazo vencer. Tirar
 * uma extensão da lista sem esvaziá-la não muda a janela, e não acorda nada.
 */
export const materializePermissionsOnOnboardingChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/extension_onboarding/{documentId}', region: REGION },
  async (event: OnboardingWriteEvent) => {
    if (onboardingWindowKey(event.data?.before) === onboardingWindowKey(event.data?.after)) return;
    await rebuild(event.params.tenantId);
  },
);

const flagOn = (snapshot: DocumentSnapshot | undefined, path: readonly string[]): boolean => {
  if (!snapshot?.exists) return false;
  let current: unknown = snapshot.data();
  for (const key of path) current = current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
  return current === true;
};

/**
 * Um workflow passou a GERAR a própria permissão, ou deixou de gerar (#33) — o catálogo ganhou ou perdeu
 * "Executar: <fluxo>". Só a troca da marca acorda: salvar um fluxo é o gesto mais comum do designer, e
 * recompor o escritório inteiro a cada passo editado seria pagar a leitura de todos os membros por nada.
 * O nome não entra: o rótulo é resolvido na tela, e renomear não muda o que ninguém tem.
 */
export const materializePermissionsOnWorkflowAccessChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/workflow_definitions/{workflowId}', region: REGION },
  async (event: WriteEvent) => {
    const path = ['access', 'restricted'];
    if (flagOn(event.data?.before, path) === flagOn(event.data?.after, path)) return;
    await rebuild(event.params.tenantId);
  },
);

/** O mesmo, para o relatório do escritório que vira (ou deixa de ser) porta: "Abrir: <relatório>". */
export const materializePermissionsOnReportAccessChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/reports/{reportId}', region: REGION },
  async (event: WriteEvent) => {
    const path = ['spec', 'access', 'restricted'];
    if (flagOn(event.data?.before, path) === flagOn(event.data?.after, path)) return;
    await rebuild(event.params.tenantId);
  },
);
