import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import type { ExpressionFunctionDef } from '../../../stores/useExpressionFunctions';

const STATIC_DEFS = `type QueryOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'exists';

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
  table: 'persons' | 'cases' | 'contracts' | 'deadlines' | 'financials' | (string & {});
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

/** Consulta os cadastros do escritório. Sempre use await. */
declare function query(spec: QuerySpec): Promise<QueryResult>;

interface UpsertSpec {
  table: 'persons' | 'cases' | 'contracts' | 'deadlines' | 'financials' | (string & {});
  /** Informe para atualizar um registro existente; omita para incluir um novo. */
  id?: string;
  /** Campos a gravar. Em cadastros fixos, os campos ficam no topo (customizados em customValues); em personalizados, dentro de values. */
  data: Record<string, unknown>;
}

interface UpsertResult {
  id: string;
  created: boolean;
  record: Record<string, unknown>;
}

interface RemoveSpec {
  table: 'persons' | 'cases' | 'contracts' | 'deadlines' | 'financials' | (string & {});
  id: string;
}

interface RemoveResult {
  id: string;
  removed: boolean;
}

/** Inclui ou atualiza um registro de um cadastro do escritório. Sempre use await. */
declare function upsert(spec: UpsertSpec): Promise<UpsertResult>;

/** Exclui um registro de um cadastro do escritório pelo id (sem cascata). Sempre use await. */
declare function remove(spec: RemoveSpec): Promise<RemoveResult>;

/** Registra uma mensagem no log de execução do Step. */
declare function log(...args: unknown[]): void;`;

const mapParamType = (param: WorkflowParameter): string => {
  switch (param.type) {
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'Date';
    case 'EntityReference':
      return param.multi ? 'string[]' : 'string';
    case 'select':
    case 'String':
    default:
      return 'string';
  }
};

const buildInputDef = (inputParams: WorkflowParameter[]): string => {
  const named = inputParams.filter((param) => param.key.trim().length > 0);
  if (named.length === 0) {
    return 'declare const input: Record<string, unknown>;';
  }
  const fields = named
    .map((param) => {
      const doc = param.label.trim() ? `  /** ${param.label.trim()} */\n` : '';
      return `${doc}  ${param.key}: ${mapParamType(param)};`;
    })
    .join('\n');
  return `declare const input: {\n${fields}\n} & Record<string, unknown>;`;
};

const parseSignatureParams = (signature: string, minArgs: number, maxArgs?: number): string => {
  const open = signature.indexOf('(');
  const close = signature.lastIndexOf(')');
  const inner = open >= 0 && close > open ? signature.slice(open + 1, close).trim() : '';

  const rawParams = inner ? inner.split(',').map((token) => token.trim()).filter(Boolean) : [];

  const parts: string[] = [];
  let usedName = false;

  rawParams.forEach((token, index) => {
    const variadic = token.includes('...');
    const optionalMark = token.includes('?');
    const cleaned = token.replace(/[.?]/g, '').trim();
    const name = /^[A-Za-z_$][\w$]*$/.test(cleaned) ? cleaned : `arg${index + 1}`;
    usedName = true;
    if (variadic || (maxArgs === undefined && index === rawParams.length - 1)) {
      parts.push(`...${name}: any[]`);
      return;
    }
    const optional = optionalMark || index >= minArgs;
    parts.push(`${name}${optional ? '?' : ''}: any`);
  });

  if (!usedName && maxArgs === undefined) {
    return '...args: any[]';
  }

  return parts.join(', ');
};

const escapeJsDoc = (text: string): string => text.replace(/\*\//g, '*\\/');

const buildFnDef = (functions: ExpressionFunctionDef[]): string => {
  if (functions.length === 0) {
    return 'declare const fn: Record<string, (...args: any[]) => any>;';
  }
  const members = functions
    .map((def) => {
      const params = parseSignatureParams(def.signature, def.minArgs, def.maxArgs);
      const docLines = [def.description, def.example ? `@example ${def.example}` : '']
        .filter(Boolean)
        .map((line) => `   * ${escapeJsDoc(line)}`)
        .join('\n');
      const doc = docLines ? `  /**\n${docLines}\n   */\n` : '';
      return `${doc}  ${def.name}(${params}): any;`;
    })
    .join('\n');
  return `declare const fn: {\n${members}\n};`;
};

export const buildScriptTypeDefs = (
  inputParams: WorkflowParameter[],
  functions: ExpressionFunctionDef[],
): string => `${STATIC_DEFS}\n\n${buildInputDef(inputParams)}\n\n${buildFnDef(functions)}\n`;
