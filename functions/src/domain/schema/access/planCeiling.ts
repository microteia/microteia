// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/planCeiling.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { PermissionCatalog } from './resolvePermissions';

/**
 * O TETO do plano sobre o conjunto concedido (#24).
 *
 * A negação viaja DENTRO da lista de permissões, como entrada `!<id>`, e não num campo ao lado. É o que
 * faz o teto alcançar o dono sem custar nada:
 *
 * - o dono tem o curinga `*`, e "tudo menos X" não se escreve como lista de concedidas — a entrada `!X`
 *   é a exceção do curinga;
 * - as Security Rules já leem `members/{uid}.permissions` em todo `can()`, e o Storage tem teto de DUAS
 *   leituras por avaliação. Um campo no próprio documento custa zero; ler o plano custaria uma a mais
 *   em toda regra;
 * - toda conta que já recebe o conjunto — `grants`, `matchesPermission`, a interseção do agente de IA, o
 *   ator de uma automação — passa a respeitar o teto sem saber que plano existe.
 *
 * `!` não é caractere válido num id de permissão (`isValidAccessPermissionId`), então a entrada nunca
 * colide com uma permissão de verdade.
 */
export const PLAN_DENIAL_PREFIX = '!';

export const planDenialEntry = (permission: string): string => `${PLAN_DENIAL_PREFIX}${permission}`;

export const isPlanDenialEntry = (entry: string): boolean => entry.startsWith(PLAN_DENIAL_PREFIX);

/** O plano nega esta permissão a quem tem este conjunto — inclusive ao curinga. */
export const deniedByPlan = (granted: readonly string[], permission: string): boolean =>
  granted.includes(planDenialEntry(permission));

/** As permissões que o conjunto de fato concede, sem as entradas de negação. */
export const grantedEntries = (granted: readonly string[]): string[] =>
  granted.filter((entry) => !isPlanDenialEntry(entry));

/**
 * O que o plano nega, com o que cai junto: toda permissão do catálogo cujo fecho alcança uma negada.
 *
 * Negar `extensions.read` e deixar `extensions.manage` concedida seria um teto que ninguém consegue
 * explicar — quem gerencia sem ver. É a mesma regra do perfil (criar exige ver), lida ao contrário:
 * lá a dependência ENTRA junto; aqui, o que depende SAI junto.
 *
 * A negada que não existe no catálogo deste escritório continua na lista: o plano é global, e a extensão
 * que a declara pode ser instalada amanhã.
 */
export const planDeniedClosure = (catalog: PermissionCatalog, denied: readonly string[]): string[] => {
  if (denied.length === 0) return [];
  const blocked = new Set(denied);
  const verdict = new Map<string, boolean>();

  const falls = (id: string, path: Set<string>): boolean => {
    if (blocked.has(id)) return true;
    const known = verdict.get(id);
    if (known !== undefined) return known;
    // Um ciclo não chega aqui (o catálogo o recusa ao montar), mas a guarda impede o laço se chegar.
    if (path.has(id)) return false;
    path.add(id);
    const result = (catalog.byId.get(id)?.requires ?? []).some((required) => falls(required, path));
    path.delete(id);
    verdict.set(id, result);
    return result;
  };

  const closure = new Set(denied);
  for (const id of catalog.byId.keys()) {
    if (falls(id, new Set())) closure.add(id);
  }
  return [...closure].sort();
};

/**
 * O conjunto concedido sob o teto: sem as negadas e, quando há negação, com as entradas `!<id>`.
 *
 * As entradas vão mesmo para quem não tem o curinga — para ele não mudam nada, porque a negada já saiu
 * da lista; mas manter uma forma só é o que deixa as rules perguntarem a mesma coisa a todo mundo.
 */
export const applyPlanCeiling = (granted: readonly string[], deniedClosure: readonly string[]): string[] => {
  const base = grantedEntries(granted);
  if (deniedClosure.length === 0) return base;
  const denied = new Set(deniedClosure);
  return [
    ...base.filter((permission) => !denied.has(permission)),
    ...[...denied].sort().map(planDenialEntry),
  ];
};
