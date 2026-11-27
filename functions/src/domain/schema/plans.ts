// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plans.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import { PERMISSION_MEMBERS_MANAGE, PERMISSION_ROLES_MANAGE } from './access/kernelPermissions';
import { containedPermissionIds } from './access/planCeiling';

/**
 * PLANOS — o que o `SYSTEM` vende, como DADO da instalação (#24).
 *
 * O plano já foi uma união fechada no kernel (`solo` | `office` | `professional` | `enterprise`), e
 * escolhê-lo só sugeria um limite de membros. Eram nomes comerciais NOSSOS dentro da plataforma — o
 * mesmo defeito dos perfis semeados —, e a lista fixa impedia o caso que mais importa a quem vende:
 * estreitar o plano de quem chega sem mudar o de quem já está nele. A saída é o plano ser um
 * documento, criado e arquivado pelo `SYSTEM`.
 *
 * Três decisões organizam o resto:
 *
 * 1. **Guardar o que é NEGADO, não o que é permitido.** O padrão é "tudo", e uma permissão que um kernel
 *    ou uma extensão acrescentar depois nasce liberada até alguém bloqueá-la. Guardar a lista de
 *    permitidas fecharia toda capacidade nova em todos os planos, sem ninguém ter decidido isso.
 * 2. **O limite de membros é PADRÃO, não regra.** Ele é copiado para o escritório ao criá-lo ou ao trocar
 *    o plano dele, e continua editável no escritório; mudar o padrão não toca quem já existe. O bloqueio,
 *    ao contrário, vale na hora para todos os escritórios do plano — é ele que define o plano.
 * 3. **Arquivar, não excluir.** O plano arquivado continua valendo para os escritórios que o têm, e deixa
 *    de ser oferecido. É o que permite manter os clientes antigos como estão.
 */

export const PLANS_COLLECTION = 'plans';

/** O limite com que nasce o escritório sem plano — o mesmo de antes de existir plano configurável. */
export const NO_PLAN_MEMBER_LIMIT = 1;

/** O dono entra pela mesma transação do limite: um padrão abaixo de 1 abriria escritório sem dono. */
export const MIN_PLAN_MEMBER_LIMIT = 1;

export interface PlanDefinition {
  id: string;
  /** Dado digitado pelo `SYSTEM` (ou uma referência `@ns/chave`): passa por `useLabel()`, sem catálogo. */
  name: string;
  /** `null` = sem limite. */
  memberLimit: number | null;
  /** Só o que foi MARCADO. O que cai junto por dependência é recalculado — ver `planDeniedClosure`. */
  deniedPermissions: string[];
  archived: boolean;
  /** As conversões de `PLAN_ACCESS_UPGRADES` que este plano já recebeu. */
  accessUpgrades: string[];
}

const deniedOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))].sort()
    : [];

const memberLimitOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_PLAN_MEMBER_LIMIT ? value : null;

/**
 * Lê o documento com tolerância: campo ilegível vira o padrão de "nenhuma restrição". Um plano gravado
 * à mão errado não pode bloquear mais do que alguém marcou.
 */
export const planDefinitionOf = (id: string, data: unknown): PlanDefinition => {
  const fields = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  return {
    id,
    name: typeof fields.name === 'string' && fields.name.trim() !== '' ? fields.name : id,
    memberLimit: memberLimitOf(fields.memberLimit),
    deniedPermissions: deniedOf(fields.deniedPermissions),
    archived: fields.archived === true,
    accessUpgrades: Array.isArray(fields.accessUpgrades)
      ? fields.accessUpgrades.filter((id): id is string => typeof id === 'string')
      : [],
  };
};

/**
 * A digital do que o plano nega, carimbada no membro junto com o conjunto materializado
 * (`permissionsPlan`). É por ela que o navegador percebe que o plano mudou e o conjunto que as rules
 * leem ficou velho — o mesmo papel de `KERNEL_CATALOG_FINGERPRINT` para o catálogo de código.
 *
 * Vazia quando o escritório não tem plano, ou o plano não nega nada: é o mesmo que o campo ausente, e
 * é o que faz o deploy desta versão não pedir recomposição a escritório nenhum.
 */
export const planStamp = (denied: readonly string[]): string => [...new Set(denied)].sort().join(',');

/**
 * As permissões que tiram do dono a capacidade de cuidar da própria equipe. Bloqueá-las é permitido —
 * a decisão é do `SYSTEM` —, mas a tela avisa antes, porque o efeito não aparece para quem bloqueia.
 */
export const PLAN_ESSENTIAL_PERMISSIONS: readonly string[] = [PERMISSION_MEMBERS_MANAGE, PERMISSION_ROLES_MANAGE];

/**
 * As vezes em que o KERNEL dividiu uma permissão e o plano que já existia precisa negar a parte nova, UMA
 * vez — o par de `ACCESS_UPGRADES`, que faz o mesmo nos perfis (#29). Lá a permissão nova nasce negada e
 * a conversão CONCEDE o que o perfil já fazia; aqui ela nasce liberada, e a conversão NEGA o que o plano
 * já negava.
 *
 * Rodar de novo não pode: depois da primeira vez, liberar `pets.attach` num plano que nega `pets.update`
 * é escolha do `SYSTEM` — é o que permite "bloqueia editar, deixa anexar", o caso das #35–#37 —, e
 * devolvê-la a cada versão desfaria a escolha em silêncio. Por isso o plano guarda as que já recebeu, e o
 * plano NOVO nasce com todas.
 */
export const PLAN_ACCESS_UPGRADES = ['contained-record-actions'] as const;

export type PlanAccessUpgradeId = (typeof PLAN_ACCESS_UPGRADES)[number];

export const pendingPlanAccessUpgrades = (applied: readonly string[]): PlanAccessUpgradeId[] => {
  const done = new Set(applied);
  return PLAN_ACCESS_UPGRADES.filter((id) => !done.has(id));
};

/** #41: o plano que negava editar a coleção nega também anexar, anotar e etiquetar nela. */
const containedRecordActions = (denied: readonly string[]): string[] => denied.flatMap(containedPermissionIds);

const PLAN_ADDITIONS: Record<PlanAccessUpgradeId, (denied: readonly string[]) => string[]> = {
  'contained-record-actions': containedRecordActions,
};

/** O que o plano nega depois das conversões pendentes, ou `null` quando nada muda. */
export const upgradePlanDenied = (
  upgrades: readonly PlanAccessUpgradeId[],
  denied: readonly string[],
): string[] | null => {
  const next = new Set(denied);
  for (const upgrade of upgrades) for (const id of PLAN_ADDITIONS[upgrade]([...next])) next.add(id);
  return next.size === new Set(denied).size ? null : [...next].sort();
};
