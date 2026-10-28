// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/actionScope.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/actionScope.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O ESCOPO das expressões de uma Action (`hiddenWhen`, `disabledWhen`, `activeWhen`,
 * `parameterDefaults`) — as variáveis reservadas e como elas se sobrepõem aos campos do registro.
 *
 * Mora fora de `actionExpression.ts` porque aquele arquivo navega referências (`referenceScope`), que
 * é front-only de propósito. O portal avalia as MESMAS expressões no servidor — o convidado não é de
 * confiança, e a condição do escritório vale para ele —, e precisa do mesmo escopo, sem a navegação.
 */

/**
 * QUEM ESTÁ OLHANDO, no escopo de uma expressão de UI (`user.id`, `user.name`, `user.permissions`).
 *
 * Existe porque a capacidade sozinha não distingue duas pessoas que a têm, e há declaração que
 * depende exatamente disso: "excluir só a MINHA notícia", "o que EU ainda não li". Sem o usuário no
 * escopo, esse tipo de regra só existia como código dentro de uma tela do kernel.
 *
 * No escritório é variável de UI: o backend não a reavalia, e uma expressão que decidisse PERMISSÃO
 * por ela estaria decidindo no lugar errado — quem barra é a regra do Firestore.
 */
export interface ExprViewer {
  id: string;
  name: string;
  /** As permissões EFETIVAS de quem olha. `"finance.write" in permissions` numa expressão. */
  permissions: string[];
}

export const EMPTY_VIEWER: ExprViewer = { id: '', name: '', permissions: [] };

/**
 * Superfície é DADO, não união fechada — pelo mesmo motivo de `EntityKey` e `ScreenListAction`. O
 * kernel desenha quatro (`detail`, `list`, `parentTab`, `portal`), mas uma extensão que inventa uma
 * superfície própria — a agenda, um quadro — precisa poder nomeá-la, senão a expressão que distingue
 * "no cartão" de "no calendário" nunca poderia ser escrita fora do bundle.
 */
export type ActionSurface = string;

/**
 * O registro aberto no PORTAL, pelo convidado. É a superfície que deixa a mesma ação valer de um jeito
 * para o escritório e de outro para quem é de fora: `hiddenWhen: 'surface != "portal"'` põe o botão só
 * no portal; `surface == "portal"`, só no escritório.
 */
export const PORTAL_ACTION_SURFACE = 'portal';

export const BUILTIN_ACTION_SURFACES = ['detail', 'list', 'parentTab', PORTAL_ACTION_SURFACE] as const;

export type ActionRelation = 'none' | 'owned' | 'related';

/**
 * Nomes reservados sobrescrevem campos de mesma chave: um campo chamado `record` não fica acessível na
 * raiz do escopo, mas segue legível por `record.record`.
 */
export const ACTION_RESERVED_VARIABLES = ['record', 'isNew', 'isDirty', 'permissions', 'surface', 'relation', 'user'] as const;

/** O que o escopo de uma expressão de ação lê — ver `ActionExprContext`, que acrescenta a navegação. */
export interface ActionScopeInput {
  /** Valores correntes do formulário, expostos na raiz do escopo (`email`, `status`…). */
  values: Record<string, unknown>;
  /** Registro como está gravado no servidor — `null` enquanto o registro é novo. */
  record: Record<string, unknown> | null;
  isNew: boolean;
  isDirty: boolean;
  /**
   * As permissões EFETIVAS de quem olha, na raiz do escopo: `"medico.delete" in permissions`.
   *
   * Aqui morava `role`, o papel fixo do escritório. Ele saiu porque não existe mais papel fixo — e
   * porque a pergunta que uma declaração precisa fazer nunca foi "quem é", e sim "pode".
   */
  permissions: string[];
  /**
   * ONDE a ação está sendo desenhada. A mesma ação faz sentidos diferentes conforme a superfície:
   * dentro da aba de outro registro, uma ação destrutiva costuma ser lida como "tirar daqui" quando
   * na verdade apaga o registro inteiro.
   *
   * - `detail` — cabeçalho do registro aberto (o padrão quando não se diz nada).
   * - `list` — cartão da listagem própria da tela.
   * - `parentTab` — cartão dentro da aba de um registro-pai.
   * - `portal` — o registro aberto pelo convidado do portal.
   */
  surface?: ActionSurface;
  /**
   * O que o registro é para o pai da aba em que aparece. Ortogonal a `surface`: aquela diz ONDE, esta
   * diz O QUÊ — e é a diferença entre apagar e desligar.
   *
   * - `none` — não está dentro da aba de ninguém.
   * - `owned` — é FILHO do pai: existe por causa dele, e excluí-lo ali é o esperado.
   * - `related` — é uma entidade de topo que apenas aponta para o pai: o gesto que cabe é
   *   desvincular, e excluir destruiria o registro inteiro.
   */
  relation?: ActionRelation;
  /** Quem está olhando. Ausente, vale o usuário vazio — nenhuma expressão sobre ele acerta. */
  user?: ExprViewer;
  /**
   * A COLEÇÃO sobre a qual a ação age. É o que `<entity>` vira em `hasPermission("<entity>.delete")`,
   * e é o que permite a mesma ação servir a qualquer tela em vez de nomear uma.
   */
  entity?: string;
  /** O fuso em que `today()` responde. Ausente, o do ambiente (`clockGate`). */
  timeZone?: string;
}

/** O escopo da expressão: os valores na raiz, e as variáveis reservadas por cima deles. */
export const actionScope = (input: ActionScopeInput): Record<string, unknown> => ({
  ...input.values,
  record: input.record ?? {},
  isNew: input.isNew,
  isDirty: input.isDirty,
  permissions: input.permissions,
  surface: input.surface ?? 'detail',
  relation: input.relation ?? 'none',
  user: input.user ?? EMPTY_VIEWER,
});

/** O contexto que o avaliador de expressões de campo recebe. */
export const actionFieldContext = (input: ActionScopeInput) => ({
  value: null,
  data: actionScope(input),
  ...(input.entity ? { entity: input.entity } : {}),
  ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  permissions: input.permissions,
});
