import { describe, expect, it } from 'vitest';
import { AGENT_SCHEMA_KEYWORDS, checkAgentInput } from './agentInput';
import { AGENT_TOOLS, agentToolByName } from './agentOps';

const schemaOf = (name: string): Record<string, unknown> => {
  const tool = agentToolByName(name);
  if (!tool) throw new Error(name);
  return tool.inputSchema;
};

const errors = (name: string, input: unknown): string[] =>
  checkAgentInput(schemaOf(name), input).map((issue) => `${issue.path} ${issue.error}`);

describe('checkAgentInput — o esquema publicado é conferido', () => {
  // O caso que motivou a conferência: o argumento de nome errado era IGNORADO, e a busca voltava a
  // coleção inteira como se fosse a resposta ao filtro.
  it('recusa argumento que o esquema não declara, dizendo quais existem', () => {
    const issues = checkAgentInput(schemaOf('search_records'), { collection: 'x', filters: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('filters');
    expect(issues[0].error).toBe('@core.access/agent.input.unknown');
    expect(issues[0].params.accepted).toBe('collection, where, orderBy, limit');
  });

  it('a ferramenta sem argumento recusa qualquer um', () => {
    expect(errors('list_screens', { collection: 'x' })).toEqual(['collection @core.access/agent.input.unknown-none']);
  });

  it('recusa o obrigatório ausente', () => {
    expect(errors('get_record', { collection: 'x' })).toEqual(['id @core.access/agent.input.missing']);
  });

  it('confere o tipo', () => {
    expect(errors('search_records', { collection: 'x', where: {} })).toEqual(['where @core.access/agent.input.type']);
    expect(errors('run_workflow', { workflow: 'w', dry_run: 'yes' })).toEqual(['dry_run @core.access/agent.input.type']);
  });

  it('desce nos itens de uma lista e nomeia a posição', () => {
    expect(errors('search_records', { collection: 'x', where: [{ path: 'a', op: 'like', value: 1 }] }))
      .toEqual(['where[0].op @core.access/agent.input.enum']);
    expect(errors('search_records', { collection: 'x', where: [{ path: 'a', op: 'eq', valor: 1 }] }))
      .toEqual(['where[0].valor @core.access/agent.input.unknown']);
  });

  it('respeita os limites numéricos', () => {
    expect(errors('search_records', { collection: 'x', limit: 0 })).toEqual(['limit @core.access/agent.input.minimum']);
    expect(errors('search_records', { collection: 'x', limit: 5000 })).toEqual(['limit @core.access/agent.input.maximum']);
    expect(errors('search_records', { collection: 'x', limit: 1.5 })).toEqual(['limit @core.access/agent.input.type']);
  });

  it('um objeto livre (params, data, prompts) aceita qualquer chave — quem confere é a ferramenta', () => {
    expect(errors('run_workflow', { workflow: 'w', params: { qualquer: 1 } })).toEqual([]);
    expect(errors('create_record', { collection: 'x', data: { a: 1 } })).toEqual([]);
  });

  it('a chamada certa passa', () => {
    expect(errors('search_records', {
      collection: 'x',
      where: [{ path: 'createdAt', op: 'gte', value: '2026-10-01' }, { path: 'a', op: 'exists' }],
      orderBy: [{ path: 'a', dir: 'desc' }],
      limit: 10,
    })).toEqual([]);
  });

  // O validador cobre um SUBCONJUNTO do JSON Schema. Uma palavra nova num esquema de ferramenta, sem
  // ele saber conferi-la, voltaria a ser anúncio sem cobrança — o defeito que ele existe para fechar.
  it('toda palavra usada nos esquemas das ferramentas é uma que o validador confere', () => {
    const used = new Set<string>();
    const collect = (schema: unknown): void => {
      if (typeof schema !== 'object' || schema === null) return;
      for (const [key, value] of Object.entries(schema)) {
        used.add(key);
        if (key === 'properties') Object.values(value as object).forEach(collect);
        if (key === 'items') collect(value);
      }
    };
    AGENT_TOOLS.forEach((tool) => collect(tool.inputSchema));
    expect([...used].filter((key) => !AGENT_SCHEMA_KEYWORDS.includes(key))).toEqual([]);
  });
});
