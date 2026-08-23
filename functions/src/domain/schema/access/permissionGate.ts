// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/permissionGate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * As permissões EFETIVAS de quem está agindo, como contexto de módulo.
 *
 * Existe pelo mesmo motivo de `i18n/localeGate.ts`: `hasPermission(...)` precisa ser uma FUNÇÃO DE
 * EXPRESSÃO, e o avaliador (`expr-eval`) não entrega o escopo às funções que se registram nele. O
 * conjunto chega por empurrão de quem o conhece — no front, o `AuthorizationStore`; no backend, quem
 * resolveu o ator antes de executar.
 *
 * Antes de alguém empurrar o primeiro conjunto, a resposta é NÃO. Um gate que concedesse por
 * omissão transformaria "ainda não sei quem é" em "pode tudo", que é o erro que não se percebe.
 */
let ambient: readonly string[] = [];

export const ambientPermissions = (): readonly string[] => ambient;

export const setAmbientPermissions = (permissions: readonly string[]): void => {
  ambient = [...permissions];
};

/** Devolve o gate ao estado inicial. Existe para os testes não vazarem acesso de um caso para outro. */
export const resetAmbientPermissions = (): void => {
  ambient = [];
};
