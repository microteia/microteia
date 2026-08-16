import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import type { ExpressionFunctionDef } from '../../../stores/useExpressionFunctions';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';
import { BUILTIN_REF_ENTITIES } from '../../../domain/entities/entitySchemas';
import type { NativeFieldSpec } from '../../../domain/schema/entityRegistry';
import { getEntityByCollection } from '../../../domain/schema/entityRegistry';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';

/**
 * A união de tabelas é montada a partir das telas INSTALADAS, e não de uma lista escrita aqui.
 *
 * Antes esta documentação citava `cases`, `contracts`, `deadlines` e `financials` — coleções de
 * entidades que saíram do kernel e hoje são extensões. O kernel não conhece nenhuma delas: citá-las
 * o amarrava a um domínio, e a lista envelhecia sozinha (um escritório sem a extensão de Processo
 * via `cases` sugerido pelo editor, e um com uma tela própria não via a dele).
 */
const tableUnion = (collections: string[]): string =>
  [...collections.map((collection) => `'${collection}'`), '(string & {})'].join(' | ');

const staticDefs = (collections: string[]): string => `type QueryOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'exists';

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

/** Consulta os cadastros do escritório. Sempre use await. */
declare function query(spec: QuerySpec): Promise<QueryResult>;

interface UpsertSpec {
  table: ${tableUnion(collections)};
  /** Informe para atualizar um registro existente; omita para incluir um novo. */
  id?: string;
  /** Campos a gravar, sempre na raiz do objeto — igual para cadastros fixos e telas do Form Design. */
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

/** Inclui ou atualiza um registro de um cadastro do escritório. Sempre use await. */
declare function upsert(spec: UpsertSpec): Promise<UpsertResult>;

/** Exclui um registro de um cadastro do escritório pelo id (sem cascata). Sempre use await. */
declare function remove(spec: RemoveSpec): Promise<RemoveResult>;

/** Registra uma mensagem no log de execução do Step. */
declare function log(...args: unknown[]): void;`;

const INDENT_UNIT = '  ';

const indentOf = (depth: number): string => INDENT_UNIT.repeat(depth);

const objectLiteral = (members: string[], depth: number): string =>
  members.length === 0
    ? 'Record<string, unknown>'
    : `{\n${members.join('\n')}\n${indentOf(depth)}} & Record<string, unknown>`;

const nativeFieldType = (field: NativeFieldSpec, depth: number): string => {
  if (field.refEntity) return field.multi ? 'string[]' : 'string';
  switch (field.type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'stringArray':
      return 'string[]';
    case 'object':
      return objectLiteral(
        (field.objectFields ?? []).map(
          (nested) => `${indentOf(depth + 1)}${nested.key}?: ${nativeFieldType(nested, depth + 1)};`,
        ),
        depth,
      );
    default:
      return 'string';
  }
};

const customFieldType = (field: FieldDefinition): string => {
  switch (field.type) {
    case 'number':
    case 'currency':
      return 'number';
    case 'checkbox':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'select':
    case 'reference':
      return field.multi ? 'string[]' : 'string';
    default:
      return 'string';
  }
};

const builtinReferenceType = (collection: string, depth: number): string => {
  const entity = getEntityByCollection(collection);
  if (!entity) return 'Record<string, unknown>';
  const fkFields: NativeFieldSpec[] = entity.fks.map((fk) => ({
    key: fk.key,
    label: fk.label,
    type: fk.multi ? 'stringArray' : 'string',
  }));
  const members = [
    `${indentOf(depth + 1)}id: string;`,
    ...[...entity.fields, ...fkFields].map(
      (field) => `${indentOf(depth + 1)}/** ${field.label} */\n${indentOf(depth + 1)}${field.key}?: ${nativeFieldType(field, depth + 1)};`,
    ),
  ];
  return objectLiteral(members, depth);
};

const customReferenceType = (screen: SchemaScreen | undefined, depth: number): string => {
  if (!screen) return 'Record<string, unknown>';
  const members = [
    `${indentOf(depth + 1)}id: string;`,
    ...screen.fields.map(
      (field) => `${indentOf(depth + 1)}/** ${field.label} */\n${indentOf(depth + 1)}${field.key}?: ${customFieldType(field)};`,
    ),
  ];
  return objectLiteral(members, depth);
};

const referenceType = (param: WorkflowParameter, screens: SchemaScreen[], depth: number): string => {
  const entityType = param.entityType ?? '';
  if (!entityType) return 'Record<string, unknown>';
  return BUILTIN_REF_ENTITIES.has(entityType)
    ? builtinReferenceType(entityType, depth)
    : customReferenceType(
        // A referência guarda a COLEÇÃO; a tela responde por ela mesmo quando leva outro nome.
        screens.find((screen) => (screen.collection ?? screen.id) === entityType),
        depth,
      );
};

const singleParamType = (param: WorkflowParameter, screens: SchemaScreen[], depth: number): string => {
  switch (param.type) {
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'Date';
    case 'EntityReference':
      return referenceType(param, screens, depth);
    case 'Object':
      return objectLiteral(paramMembers(param.fields ?? [], screens, depth + 1), depth);
    case 'lookup':
    case 'select':
    case 'String':
    default:
      return 'string';
  }
};

const mapParamType = (param: WorkflowParameter, screens: SchemaScreen[], depth: number): string => {
  const single = singleParamType(param, screens, depth);
  return param.list ? `(${single})[]` : single;
};

function paramMembers(params: WorkflowParameter[], screens: SchemaScreen[], depth: number): string[] {
  return params
    .filter((param) => param.key.trim().length > 0)
    .map((param) => {
      const doc = param.label.trim() ? `${indentOf(depth)}/** ${param.label.trim()} */\n` : '';
      return `${doc}${indentOf(depth)}${param.key}: ${mapParamType(param, screens, depth)};`;
    });
}

const buildInputDef = (inputParams: WorkflowParameter[], screens: SchemaScreen[]): string => {
  const members = paramMembers(inputParams, screens, 1);
  if (members.length === 0) {
    return 'declare const input: Record<string, unknown>;';
  }
  return `declare const input: ${objectLiteral(members, 0)};`;
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
  screens: SchemaScreen[] = [],
): string => {
  const collections = screens.map((screen) => screen.collection ?? screen.id).sort();
  return `${staticDefs(collections)}\n\n${buildInputDef(inputParams, screens)}\n\n${buildFnDef(functions)}\n`;
};
