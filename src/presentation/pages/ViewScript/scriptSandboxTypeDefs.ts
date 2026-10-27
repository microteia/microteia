/**
 * Os globais que o sandbox de script entrega — `query`, `upsert`, `remove`, `log` e `actor` —, descritos
 * UMA vez para dois leitores: o Monaco do editor de scripts e o `sdk/types/microteia-sandbox.d.ts`, que
 * viaja no SDK e é o que o `tsc` do workspace do escritório usa para checar um `.script.ts` ou um
 * `.migration.ts`. Duas descrições do mesmo sandbox envelheceriam separadas — foi assim que a migração de
 * exemplo leu `query().rows` por meses, num arquivo que nenhum projeto checava.
 *
 * Este módulo não importa NADA, de propósito: `scripts/export-host-types.mjs` o carrega com `sucrase`,
 * como faz com `extensionTypeDefs.ts`. O texto é em inglês pela mesma razão daquele: é documentação de
 * API entregue a quem escreve o script, não comentário nosso.
 *
 * `input` e `fn` ficam de fora: os dois dependem do que só a tela conhece (os parâmetros do script e as
 * funções carregadas), e cada leitor os declara por conta própria.
 */

/**
 * A união de tabelas é montada a partir das telas INSTALADAS, e não de uma lista escrita aqui.
 *
 * Antes esta documentação citava `cases`, `contracts`, `deadlines` e `financials` — coleções de
 * entidades que saíram do kernel e hoje são extensões. O kernel não conhece nenhuma delas: citá-las
 * o amarrava a um domínio, e a lista envelhecia sozinha (um escritório sem a extensão de Processo
 * via `cases` sugerido pelo editor, e um com uma tela própria não via a dele). Sem tela nenhuma — o
 * caso do `.d.ts` do SDK — sobra `string`, que é o que o sandbox aceita.
 */
const tableUnion = (collections: string[]): string =>
  [...collections.map((collection) => `'${collection}'`), '(string & {})'].join(' | ');

export const buildScriptSandboxTypeDefs = (collections: string[]): string => `type QueryOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'exists';

interface QueryPredicate {
  path: string;
  op: QueryOperator;
  value?: unknown;
}

interface QueryOrderBy {
  path: string;
  dir: 'asc' | 'desc';
}

interface QuerySpec {
  table: ${tableUnion(collections)};
  where?: QueryPredicate[];
  orderBy?: QueryOrderBy[];
  limit?: number;
  projections?: string[];
}

interface QueryResult {
  count: number;
  results: Record<string, unknown>[];
  first: Record<string, unknown> | null;
}

/** Reads the organization's records. Always await it. */
declare function query(spec: QuerySpec): Promise<QueryResult>;

interface UpsertSpec {
  table: ${tableUnion(collections)};
  /** Set it to update an existing record; leave it out to create a new one. */
  id?: string;
  /** The fields to write, always at the root of the object — the same for every collection. */
  data: Record<string, unknown>;
}

interface UpsertResult {
  id: string;
  created: boolean;
  record: Record<string, unknown>;
}

interface RemoveSpec {
  table: ${tableUnion(collections)};
  id: string;
}

interface RemoveResult {
  id: string;
  removed: boolean;
}

/** Creates or updates one record. Always await it. */
declare function upsert(spec: UpsertSpec): Promise<UpsertResult>;

/** Deletes one record by id, with no cascade. Always await it. */
declare function remove(spec: RemoveSpec): Promise<RemoveResult>;

/** Writes a message to the execution log of the step. */
declare function log(...args: unknown[]): void;

/**
 * Who started the run: \`via\` is 'ui' (a button in the app) or 'agent' (an AI agent, on that person's
 * behalf). \`null\` when no person started it — an automation triggered by a write. Whatever \`upsert\`
 * writes is authored by this person.
 */
declare const actor: { id: string; name: string; via: 'ui' | 'agent' } | null;`;
