// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowChangeFilter.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O FILTRO DE MUDANÇA de um gatilho de registro salvo — "só na criação", "só quando a situação
 * mudar".
 *
 * Existia como condição escrita à mão (`old.situacao != situacao`), e é a pergunta mais comum de
 * quem automatiza: sem o filtro, uma automação de "ao salvar" roda a cada vírgula corrigida no
 * registro, e quem a escreveu descobre pelo e-mail repetido. Declarado, ele é lido sem expressão, o
 * editor oferece os campos da tela, e o motor responde antes de qualquer passo.
 */
export type WorkflowChangeType = 'created' | 'updated';

/**
 * O kernel que passou a entender o filtro, o `Switch` e a política de falha do passo.
 *
 * Um kernel anterior não RECUSA nenhum dos três: ignora o filtro (e a automação passa a rodar a cada
 * salvamento), ignora a política (e a falha encerra a execução). Por isso o portão do pacote cobra o
 * `kernel` declarado — é a única forma de o kernel velho recusar o pacote pelo nome, em vez de rodá-lo
 * com outro comportamento.
 */
export const WORKFLOW_FLOW_CONTROL_SINCE_KERNEL = '2.108.0';

export const WORKFLOW_CHANGE_TYPES: readonly WorkflowChangeType[] = ['created', 'updated'];

export interface WorkflowChangeFilter {
  /** Ausente = criação e alteração. */
  changeType?: WorkflowChangeType | null;
  /**
   * Os campos cuja MUDANÇA dispara. Vazio ou ausente = qualquer mudança. Basta UM ter mudado.
   *
   * Na criação, "mudou" é "nasceu preenchido": um registro criado já com a situação "Vencido" é a
   * mesma notícia que um que passou a "Vencido", e quem pediu "quando a situação mudar" espera as
   * duas.
   */
  changedFields?: string[] | null;
}

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === ''
  || (Array.isArray(value) && value.length === 0);

/**
 * A forma CANÔNICA de um valor para comparação: objetos com as chaves em ordem. O registro antigo e o
 * novo atravessam o barramento separadamente, e a ordem das chaves de um mapa não é afirmação nenhuma
 * — compará-la diria que um endereço "mudou" porque o Firestore o devolveu em outra ordem.
 */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value instanceof Date ? value.toISOString() : value;
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
};

/**
 * O evento passa pelo filtro? O payload é o de `<coleção>.saved`: os campos do registro na raiz,
 * `changeType` e — numa alteração — `old`, o registro como era.
 *
 * Um evento sem `changeType` não é de registro salvo, e o filtro não se aplica a ele: responder "não"
 * calaria uma automação cujo gatilho foi trocado depois de o filtro ter sido escolhido.
 */
export const matchesChangeFilter = (
  filter: WorkflowChangeFilter,
  payload: Record<string, unknown>,
): boolean => {
  const changeType = payload.changeType;
  if (changeType !== 'created' && changeType !== 'updated') return true;
  if (filter.changeType && filter.changeType !== changeType) return false;

  const fields = (filter.changedFields ?? []).filter((field) => typeof field === 'string' && field !== '');
  if (fields.length === 0) return true;

  if (changeType === 'created') return fields.some((field) => !isEmptyValue(payload[field]));

  const old = (payload.old ?? {}) as Record<string, unknown>;
  return fields.some((field) => !sameValue(old[field], payload[field]));
};

/** O filtro declara algo? Ausente e vazio são a mesma resposta: todo salvamento passa. */
export const hasChangeFilter = (filter: WorkflowChangeFilter): boolean =>
  Boolean(filter.changeType) || (filter.changedFields ?? []).some((field) => field !== '');
