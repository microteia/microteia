import { evaluateFieldBoolean } from './fieldExpression';

/**
 * QUEM ESTÁ OLHANDO, no escopo de uma expressão de UI (`user.id`, `user.name`, `user.role`).
 *
 * Existe porque `role` sozinho não distingue duas pessoas do mesmo papel, e há declaração que
 * depende exatamente disso: "excluir só a MINHA notícia", "o que EU ainda não li". Sem o usuário no
 * escopo, esse tipo de regra só existia como código dentro de uma tela do kernel.
 *
 * É variável de UI, como o resto deste módulo: o backend não a reavalia. Uma expressão que decidisse
 * PERMISSÃO por ela estaria decidindo no lugar errado — quem barra é a regra do Firestore.
 */
export interface ExprViewer {
  id: string;
  name: string;
  role: string;
}

export const EMPTY_VIEWER: ExprViewer = { id: '', name: '', role: '' };

/**
 * Contexto das expressões `hiddenWhen` / `disabledWhen` de uma Action. Puramente de UI — o backend não
 * as reavalia, do mesmo modo que `FieldLogic.hiddenWhen`/`disabledWhen`.
 */
export interface ActionExprContext {
  /** Valores correntes do formulário, expostos na raiz do escopo (`email`, `status`…). */
  values: Record<string, unknown>;
  /** Registro como está gravado no servidor — `null` enquanto o registro é novo. */
  record: Record<string, unknown> | null;
  isNew: boolean;
  isDirty: boolean;
  /** Papel do usuário no escritório: `admin`, `lawyer`, `secretary` ou `user`. */
  role: string;
  /**
   * ONDE a ação está sendo desenhada. A mesma ação faz sentidos diferentes conforme a superfície:
   * dentro da aba de outro registro, uma ação destrutiva costuma ser lida como "tirar daqui" quando
   * na verdade apaga o registro inteiro.
   *
   * - `detail` — cabeçalho do registro aberto (o padrão quando não se diz nada).
   * - `list` — cartão da listagem própria da tela.
   * - `parentTab` — cartão dentro da aba de um registro-pai.
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
}

/**
 * Superfície é DADO, não união fechada — pelo mesmo motivo de `EntityKey` e `ScreenListAction`. O
 * kernel desenha três (`detail`, `list`, `parentTab`), mas uma extensão que inventa uma superfície
 * própria — a agenda, um quadro — precisa poder nomeá-la, senão a expressão que distingue "no
 * cartão" de "no calendário" nunca poderia ser escrita fora do bundle.
 */
export type ActionSurface = string;

export const BUILTIN_ACTION_SURFACES = ['detail', 'list', 'parentTab'] as const;

export type ActionRelation = 'none' | 'owned' | 'related';

/**
 * Nomes reservados sobrescrevem campos de mesma chave: um campo chamado `record` não fica acessível na
 * raiz do escopo, mas segue legível por `record.record`.
 */
export const ACTION_RESERVED_VARIABLES = ['record', 'isNew', 'isDirty', 'role', 'surface', 'relation', 'user'] as const;

const buildScope = (ctx: ActionExprContext): Record<string, unknown> => ({
  ...ctx.values,
  record: ctx.record ?? {},
  isNew: ctx.isNew,
  isDirty: ctx.isDirty,
  role: ctx.role,
  surface: ctx.surface ?? 'detail',
  relation: ctx.relation ?? 'none',
  user: ctx.user ?? EMPTY_VIEWER,
});

export const isActionHidden = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) });

export const isActionDisabled = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) });

/**
 * A ação está LIGADA? Só faz sentido quando ela declara `activeWhen`; sem declaração, `undefined`
 * diz "não é um interruptor" — diferente de `false`, que é o interruptor desligado.
 */
export const actionActiveState = (
  expr: string | null | undefined,
  ctx: ActionExprContext,
): boolean | undefined =>
  expr?.trim() ? evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) }) : undefined;
