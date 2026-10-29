// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordImport.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordImport.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O contrato da IMPORTAÇÃO EM MASSA de registros de uma tela — o que o navegador manda e o que o servidor
 * devolve.
 *
 * O arquivo é lido e mapeado no navegador; o servidor recebe as linhas JÁ como `data` de um `upsert` e as
 * grava pelo mesmo `runWorkflowUpsert` do passo "Gravar Registro", do agente e do portal. Não há um
 * caminho de gravação novo: há uma porta nova para o caminho que já confere campos, regras, chaves,
 * sequência, janela de edição e visibilidade.
 */

/** O job de cada importação executada, sob o escritório. Só o servidor lê e grava. */
export const RECORD_IMPORTS_COLLECTION = 'record_imports';

/** O teto de linhas de UMA importação. Acima disso, o arquivo é dividido por quem o preparou. */
export const RECORD_IMPORT_MAX_ROWS = 50_000;

/**
 * Linhas por chamada. Cada linha é uma gravação completa (leitura da chave, do registro, transação), e o
 * lote precisa caber com folga no tempo de uma callable.
 */
export const RECORD_IMPORT_BATCH_SIZE = 100;

/** Por quantos dias o job fica guardado. A prova do que foi gravado é o registro e a Auditoria. */
export const RECORD_IMPORT_RETENTION_DAYS = 30;

/** Uma linha do arquivo, já mapeada: `line` é o número dela no ARQUIVO, que é o que a pessoa procura. */
export interface RecordImportRow {
  line: number;
  data: Record<string, unknown>;
}

export const RECORD_IMPORT_ROW_STATUSES = ['created', 'updated', 'failed'] as const;
export type RecordImportRowStatus = (typeof RECORD_IMPORT_ROW_STATUSES)[number];

/**
 * O que aconteceu com a linha. Na simulação, `created`/`updated` dizem o que ACONTECERIA. `error` é uma
 * REFERÊNCIA de mensagem, e `errorParams` traz o que a frase interpola.
 */
export interface RecordImportRowResult {
  line: number;
  status: RecordImportRowStatus;
  id?: string;
  error?: string;
  errorParams?: Record<string, string>;
}

export interface RecordImportTotals {
  created: number;
  updated: number;
  failed: number;
}

export const RECORD_IMPORT_STATUSES = ['running', 'finished', 'cancelled'] as const;
export type RecordImportStatus = (typeof RECORD_IMPORT_STATUSES)[number];

/**
 * A importação feita na aba de um registro-pai: o campo de vínculo e o registro aberto. O servidor grava
 * o campo em cada linha — ele nunca é coluna do arquivo — e não altera registro que aponta para outro pai.
 */
export interface RecordImportParent {
  fieldKey: string;
  recordId: string;
}

/**
 * A coluna de um campo de referência que traz a CHAVE do registro apontado (o CPF, a inscrição) em vez
 * do id dele. `key` é o nome de uma chave declarada do alvo, de um campo só.
 */
export interface RecordImportLookup {
  fieldKey: string;
  key: string;
}

/** Quantas colunas de uma importação podem procurar o alvo pela chave. */
export const RECORD_IMPORT_MAX_LOOKUPS = 20;

export type RecordImportRequest =
  | { op: 'start'; tenantId: string; table: string; fileName: string; totalRows: number; parent?: RecordImportParent }
  | {
    op: 'rows';
    tenantId: string;
    table: string;
    /** Ausente só na simulação, que não abre job. */
    importId?: string;
    dryRun: boolean;
    rows: RecordImportRow[];
    /** Só na simulação. Na execução, vale o pai do job. */
    parent?: RecordImportParent;
    lookups?: RecordImportLookup[];
  }
  | { op: 'finish'; tenantId: string; importId: string; cancelled?: boolean };

export interface RecordImportStartResponse {
  importId: string;
}

export interface RecordImportRowsResponse {
  results: RecordImportRowResult[];
}

export interface RecordImportFinishResponse {
  totals: RecordImportTotals;
}

export const emptyImportTotals = (): RecordImportTotals => ({ created: 0, updated: 0, failed: 0 });

export const tallyImportResults = (
  results: readonly RecordImportRowResult[],
  base: RecordImportTotals = emptyImportTotals(),
): RecordImportTotals =>
  results.reduce(
    (totals, result) => ({ ...totals, [result.status]: totals[result.status] + 1 }),
    base,
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O lote que chega do navegador, conferido na forma antes de qualquer leitura. Recusa o lote inteiro: um
 * lote malformado não é erro de uma linha, é de quem o montou. Devolve a REFERÊNCIA da recusa, ou `null`.
 */
export const recordImportRowsIssue = (rows: unknown): string | null => {
  if (!Array.isArray(rows) || rows.length === 0) return '@core.records/import.error.batch-empty';
  if (rows.length > RECORD_IMPORT_BATCH_SIZE) return '@core.records/import.error.batch-too-large';
  const lines = new Set<number>();
  for (const row of rows) {
    if (!isPlainObject(row) || !isPlainObject(row.data)) return '@core.records/import.error.batch-malformed';
    if (!Number.isInteger(row.line) || (row.line as number) < 1) return '@core.records/import.error.batch-malformed';
    if (lines.has(row.line as number)) return '@core.records/import.error.batch-malformed';
    lines.add(row.line as number);
  }
  return null;
};

/** O total declarado no início, dentro do teto. */
export const recordImportTotalIssue = (totalRows: unknown): string | null =>
  Number.isInteger(totalRows) && (totalRows as number) >= 1 && (totalRows as number) <= RECORD_IMPORT_MAX_ROWS
    ? null
    : '@core.records/import.error.too-many-rows';

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !value.includes('/');

/** O pai na forma, antes de qualquer leitura. Ausente é a importação de sempre. */
export const recordImportParentIssue = (parent: unknown): string | null => {
  if (parent === undefined || parent === null) return null;
  return isPlainObject(parent) && isIdentifier(parent.fieldKey) && isIdentifier(parent.recordId)
    ? null
    : '@core.records/import.error.batch-malformed';
};

/** As colunas que procuram pela chave, na forma: no máximo uma por campo. */
export const recordImportLookupsIssue = (lookups: unknown): string | null => {
  if (lookups === undefined || lookups === null) return null;
  if (!Array.isArray(lookups) || lookups.length > RECORD_IMPORT_MAX_LOOKUPS) return '@core.records/import.error.batch-malformed';
  const fields = new Set<string>();
  for (const lookup of lookups) {
    if (!isPlainObject(lookup) || !isIdentifier(lookup.fieldKey) || !isIdentifier(lookup.key)) {
      return '@core.records/import.error.batch-malformed';
    }
    if (fields.has(lookup.fieldKey)) return '@core.records/import.error.batch-malformed';
    fields.add(lookup.fieldKey);
  }
  return null;
};
