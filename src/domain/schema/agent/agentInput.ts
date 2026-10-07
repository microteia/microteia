/**
 * A conferência dos ARGUMENTOS de uma ferramenta de agente contra o esquema que ela publica.
 *
 * O esquema sempre disse `additionalProperties: false`, e o servidor nunca o conferiu: um argumento
 * de nome errado era ignorado em silêncio. Para um modelo isso é o pior desfecho possível — `filters`
 * no lugar de `where` devolvia a coleção inteira sem filtro, e a resposta parecia certa. A recusa
 * NOMEIA o argumento e diz quais existem, que é o que permite acertar na chamada seguinte.
 *
 * Cobre só o subconjunto do JSON Schema que as ferramentas usam (`type`, `properties`, `required`,
 * `additionalProperties`, `enum`, `items`, `minimum`, `maximum`). Um esquema que passe a usar outra
 * palavra precisa dela aqui — e `agentInput.test.ts` confere que cada palavra usada é conhecida.
 */

export interface AgentInputIssue {
  /** Caminho do argumento, no formato que o modelo escreveu: `where[0].op`. */
  path: string;
  /** REFERÊNCIA de mensagem; `params` traz o que a frase interpola. */
  error: string;
  params: Record<string, string>;
}

export const AGENT_SCHEMA_KEYWORDS: readonly string[] = [
  'type', 'description', 'properties', 'required', 'additionalProperties', 'enum', 'items', 'minimum', 'maximum',
];

type JsonSchema = Record<string, unknown>;

const typeOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

const matchesType = (expected: string, value: unknown): boolean => {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
};

const join = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

const check = (schema: JsonSchema, value: unknown, path: string, issues: AgentInputIssue[]): void => {
  const expected = typeof schema.type === 'string' ? schema.type : undefined;
  if (expected !== undefined && !matchesType(expected, value)) {
    issues.push({ path, error: '@core.access/agent.input.type', params: { path, expected } });
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    issues.push({
      path,
      error: '@core.access/agent.input.enum',
      params: { path, allowed: schema.enum.map(String).join(', ') },
    });
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      issues.push({ path, error: '@core.access/agent.input.minimum', params: { path, limit: String(schema.minimum) } });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      issues.push({ path, error: '@core.access/agent.input.maximum', params: { path, limit: String(schema.maximum) } });
    }
  }

  if (Array.isArray(value) && typeof schema.items === 'object' && schema.items !== null) {
    value.forEach((item, index) => check(schema.items as JsonSchema, item, `${path}[${index}]`, issues));
  }

  const properties = schema.properties as Record<string, JsonSchema> | undefined;
  if (properties === undefined || typeOf(value) !== 'object') return;

  const record = value as Record<string, unknown>;
  const accepted = Object.keys(properties);
  for (const key of (schema.required ?? []) as string[]) {
    if (record[key] === undefined) {
      issues.push({ path: join(path, key), error: '@core.access/agent.input.missing', params: { path: join(path, key) } });
    }
  }
  for (const [key, child] of Object.entries(record)) {
    if (key in properties) {
      if (child !== undefined) check(properties[key], child, join(path, key), issues);
      continue;
    }
    if (schema.additionalProperties === false) {
      issues.push({
        path: join(path, key),
        error: accepted.length > 0 ? '@core.access/agent.input.unknown' : '@core.access/agent.input.unknown-none',
        params: { path: join(path, key), accepted: accepted.join(', ') },
      });
    }
  }
};

/** As recusas, na ordem em que aparecem — vazio quando os argumentos servem ao esquema. */
export const checkAgentInput = (schema: JsonSchema, input: unknown): AgentInputIssue[] => {
  const issues: AgentInputIssue[] = [];
  check(schema, input, '', issues);
  return issues;
};
