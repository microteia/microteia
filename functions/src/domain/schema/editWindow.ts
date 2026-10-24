// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/editWindow.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JANELA DE EDIÇÃO — o registro que só pode ser alterado até N minutos depois de criado.
 *
 * Existe para o registro que vale como PROVA do que foi dito ou feito: uma mensagem, um apontamento de
 * horas, um lançamento. Depois de lido por alguém, mudar o texto muda a prova — e uma trava que só o
 * formulário respeita não é segurança, é sugestão.
 *
 * A declaração é da TELA (`ScreenDefinition.editWindow`) e vale em três pontas, todas derivadas dela:
 *
 * 1. o formulário trava os campos (e o gesto de excluir, com `delete: true`) dizendo por quê;
 * 2. os caminhos de gravação — o repositório do front e `runWorkflowUpsert`/`runWorkflowRemove`, por
 *    onde passam automação, Script, agente (MCP) e portal — recusam fora da janela;
 * 3. o `firestore.rules` recusa `update` (e `delete`) quando `request.time` passou de
 *    `createdAt + minutos`. É esta que faz valer contra quem grava direto no banco.
 *
 * As funções daqui são a mesma conta nas duas primeiras pontas, e espelham a terceira linha a linha —
 * inclusive no que ela faz com a declaração malformada e com o registro sem `createdAt`: FECHA.
 */

import type { SchemaContext } from './screenEntity';

/**
 * O kernel a partir do qual `editWindow` é lido. Um kernel anterior DESCARTA a chave ao materializar a
 * tela, e o registro que a extensão quis proteger continuaria editável para sempre, sem aviso. Por isso
 * o pacote que a declara tem de exigir este kernel.
 */
export const EDIT_WINDOW_SINCE_KERNEL = '2.68.0';

export interface EditWindowSpec {
  /** Minutos contados de `createdAt`. Inteiro positivo. */
  minutes: number;
  /** Também trava a EXCLUSÃO depois do prazo. Ausente = excluir segue só a permissão da coleção. */
  delete?: boolean;
}

/**
 * O que o repositório carimba em toda gravação. Não é dado de negócio, e a regra do Firestore o deixa
 * passar junto dos campos que qualquer membro grava — a mesma lista de `touchesOnlyMemberWritableFields`.
 */
export const EDIT_WINDOW_STAMP_FIELDS: readonly string[] = ['updatedAt', 'updatedVia'];

/**
 * O carimbo de quem excluiu, gravado logo antes da exclusão (`stampDeletionActor`). Com a exclusão
 * livre (`delete` ausente), ele precisa passar depois do prazo — senão a janela travaria, por tabela,
 * a exclusão que ela não declarou travar.
 */
export const DELETION_STAMP_FIELDS: readonly string[] = ['deletedBy', 'deletedByName', 'deletedByPhotoURL'];

export type EditWindowIssue = 'shape' | 'minutes' | 'delete';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O defeito de uma declaração, ou `null` quando ela é válida. É o que o `check` do pacote cobra:
 * `minutes` inteiro e positivo — a regra do Firestore converte com `duration.value(minutes, 'm')`, que
 * só aceita inteiro — e `delete`, quando presente, booleano.
 */
export const editWindowIssue = (value: unknown): EditWindowIssue | null => {
  if (!isPlainObject(value)) return 'shape';
  const { minutes } = value;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0) return 'minutes';
  if (value.delete !== undefined && typeof value.delete !== 'boolean') return 'delete';
  return null;
};

/**
 * A declaração como a REGRA a enxerga. Ausente → `null` (sem janela). Malformada → fechada desde
 * sempre (`minutes: 0`), porque é o que a regra faz: o `minutes` que não é inteiro positivo nega a
 * alteração. O `delete` é lido do que está gravado, pelo mesmo motivo — a regra só trava a exclusão
 * quando ele é `true`.
 */
export const readEditWindow = (value: unknown): EditWindowSpec | null => {
  if (value === null || value === undefined) return null;
  // Sobre o que nem é mapa, o `.get` da regra é erro — e erro nega a alteração E a exclusão.
  if (!isPlainObject(value)) return { minutes: 0, delete: true };
  const minutes = editWindowIssue(value) === 'minutes' ? 0 : (value.minutes as number);
  return { minutes, ...(value.delete === true ? { delete: true } : {}) };
};

/**
 * O instante de um `createdAt`, venha de onde vier: `Date` (o registro já mapeado no front) ou o
 * `Timestamp` do SDK cliente ou do Admin (`toMillis`). Qualquer outra coisa — inclusive a ausência — é
 * `null`, como `is timestamp` na regra.
 */
export const instantMillis = (value: unknown): number | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'object' || value === null) return null;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  return typeof toMillis === 'function' ? (toMillis as () => number).call(value) : null;
};

/**
 * Quando a janela fecha. `null` quando o registro não tem `createdAt` legível: a regra exige
 * `createdAt is timestamp`, e o registro sem ele está FECHADO — não aberto para sempre.
 */
export const editWindowClosesAt = (spec: EditWindowSpec, createdAt: unknown): Date | null => {
  const created = instantMillis(createdAt);
  if (created === null) return null;
  return new Date(created + spec.minutes * 60_000);
};

export const isEditWindowOpen = (spec: EditWindowSpec, createdAt: unknown, now: Date): boolean => {
  const closesAt = editWindowClosesAt(spec, createdAt);
  return spec.minutes > 0 && closesAt !== null && now.getTime() < closesAt.getTime();
};

const sameStoredValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  const instantA = instantMillis(a);
  const instantB = instantMillis(b);
  if (instantA !== null || instantB !== null) return instantA === instantB;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b)
      && a.length === b.length
      && a.every((item, index) => sameStoredValue(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameStoredValue(a[key], b[key]));
  }
  return false;
};

/**
 * As chaves de topo que a gravação de `payload` sobre `before` de fato ALTERA — o
 * `diff(...).affectedKeys()` da regra. Uma chave reenviada com o mesmo valor não conta: o formulário
 * manda todos os campos, e só os que mudaram são alteração.
 */
export const changedRecordKeys = (
  before: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown>,
): string[] => Object.entries(payload)
  .filter(([, value]) => value !== undefined)
  .filter(([key, value]) => !(before && key in before) || !sameStoredValue(before[key], value))
  .map(([key]) => key);

export interface EditWindowChange {
  /** O que a gravação altera — `changedRecordKeys`. */
  changedKeys: readonly string[];
  /** Os campos que qualquer membro grava (`ScreenDefinition.memberWritableFields`). */
  memberWritableFields?: readonly string[] | null;
}

/**
 * A alteração passa? Dentro da janela, sempre. Fora dela, só o que não é conteúdo: o que qualquer
 * membro grava (marcar como lida, curtir) e o carimbo de quem exclui, quando a exclusão é livre.
 * `createdAt` nunca muda — regravá-lo reabriria a janela.
 */
export const editWindowAllowsUpdate = (
  spec: EditWindowSpec,
  createdAt: unknown,
  now: Date,
  change: EditWindowChange,
): boolean => {
  if (change.changedKeys.includes('createdAt')) return false;
  if (isEditWindowOpen(spec, createdAt, now)) return true;
  const memberWritable = new Set([...(change.memberWritableFields ?? []), ...EDIT_WINDOW_STAMP_FIELDS]);
  if (change.changedKeys.every((key) => memberWritable.has(key))) return true;
  return spec.delete !== true && change.changedKeys.every((key) => DELETION_STAMP_FIELDS.includes(key));
};

export const editWindowAllowsDelete = (spec: EditWindowSpec, createdAt: unknown, now: Date): boolean =>
  spec.delete !== true || isEditWindowOpen(spec, createdAt, now);

export interface ResolvedEditWindow {
  spec: EditWindowSpec;
  memberWritableFields: readonly string[];
}

/**
 * A janela que vale para a COLEÇÃO — a do documento `screenDefinitions/<coleção>`, que é o que a regra
 * lê. `indexScreens` já põe ali a declaração desse documento, inclusive quando a tela que o
 * escritório usa é outra (`dataCollection`).
 */
export const resolveEditWindow = (ctx: SchemaContext, collection: string): ResolvedEditWindow | null => {
  const screen = ctx.screens.get(collection);
  const spec = readEditWindow(screen?.editWindow);
  if (!spec) return null;
  return { spec, memberWritableFields: screen?.memberWritableFields ?? [] };
};
