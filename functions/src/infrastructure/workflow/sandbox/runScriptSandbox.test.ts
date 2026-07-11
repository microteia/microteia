import { describe, it, expect } from 'vitest';
import { runScriptSandbox } from './runScriptSandbox';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';
import type { IWorkflowQueryRepository } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';

const logs: string[] = [];

const makeContext = (input: Record<string, unknown>): WorkflowContext => ({
  event: {
    id: 'evt-1',
    tenantId: 'tenant-1',
    name: 'test.event',
    payload: {},
    timestamp: new Date('2026-07-11T12:00:00.000Z'),
  },
  outputs: {},
  variables: {},
  services: {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    now: () => new Date('2026-07-11T12:00:00.000Z'),
  },
  logger: {
    info: (m: string) => logs.push(m),
    warn: (m: string) => logs.push(m),
    error: (m: string) => logs.push(m),
  },
  execution: { id: 'exec-1', workflowDefinitionId: 'wf-1', tenantId: 'tenant-1' },
  input,
});

const deps: WorkflowQueryDeps = {
  queryRepository: {
    queryByEquality: async () => [],
  } as unknown as IWorkflowQueryRepository,
  fetcher: {} as IWorkflowRecordFetcher,
  screenProvider: {} as IScreenDefinitionProvider,
};

const run = (js: string, input: Record<string, unknown>) => runScriptSandbox(js, input, makeContext(input), deps);

const wrapMain = (body: string) => `async function main() {\n${body}\n}\nmain();`;

describe('runScriptSandbox — compatibilidade fn.* (Expression) com QuickJS', () => {
  it('preserva o objeto input e o retorna intacto', async () => {
    const out = await run(wrapMain('return { ...input };'), { cpf: '123.456.789-00', nome: 'Ana' });
    expect(out).toEqual({ cpf: '123.456.789-00', nome: 'Ana' });
  });

  it('fn.upper / fn.lower / fn.trim funcionam dentro do sandbox', async () => {
    const out = await run(
      wrapMain('return { u: fn.upper(input.nome), l: fn.lower(input.nome), t: fn.trim(input.padded) };'),
      { nome: 'Ana', padded: '  x  ' },
    );
    expect(out).toEqual({ u: 'ANA', l: 'ana', t: 'x' });
  });

  it('fn.concat retorna string concatenada', async () => {
    const out = await run(wrapMain('return { r: fn.concat("Processo ", input.n) };'), { n: 123 });
    expect(out).toEqual({ r: 'Processo 123' });
  });

  it('fn.replace trata a busca como texto literal — remove os pontos do CPF', async () => {
    const out = await run(wrapMain('return { cpf: fn.replace(input.cpf, ".", "") };'), { cpf: '123.456.789-00' });
    expect(out.cpf).toBe('123456789-00');
  });

  it('fn.replace substitui todas as ocorrências (não só a primeira)', async () => {
    const out = await run(wrapMain('return { r: fn.replace(input.s, "-", "/") };'), { s: 'a-b-c' });
    expect(out).toEqual({ r: 'a/b/c' });
  });

  it('fn.replace não interpreta metacaracteres de regex ($, parênteses)', async () => {
    const out = await run(wrapMain('return { r: fn.replace(input.s, "(a)", "X") };'), { s: 'x(a)y(a)z' });
    expect(out).toEqual({ r: 'xXyXz' });
  });

  it('fn.split trata separador como literal (correto)', async () => {
    const out = await run(wrapMain('return { parts: fn.split(input.s, ".") };'), { s: '1.2.3' });
    expect(out).toEqual({ parts: ['1', '2', '3'] });
  });

  it('quando fn lança erro, main() rejeita e o output inteiro é perdido', async () => {
    await expect(
      run(wrapMain('return { cpf: fn.replace(input.cpf, ".", "") };'), { cpf: 12345 }),
    ).rejects.toThrow(/replace/i);
  });

  it('fn.formatDate lida com Date atravessando a ponte host<->VM (tokens DD/MM/YYYY)', async () => {
    const out = await run(
      wrapMain('return { d: fn.formatDate(input.data, "DD/MM/YYYY") };'),
      { data: new Date('2026-07-11T12:00:00.000Z') },
    );
    expect(typeof out.d).toBe('string');
    expect(out.d).toContain('2026');
    expect(out.d).toContain('07');
  });

  it('ARMADILHA: fn.formatDate é case-sensitive — tokens minúsculos ficam literais', async () => {
    const out = await run(
      wrapMain('return { d: fn.formatDate(input.data, "dd/MM/yyyy") };'),
      { data: new Date('2026-07-11T12:00:00.000Z') },
    );
    // "dd" e "yyyy" não são reconhecidos; só "MM" é substituído.
    expect(out.d).toBe('dd/07/yyyy');
  });

  it('fn.isCPF valida CPF', async () => {
    const out = await run(wrapMain('return { ok: fn.isCPF(input.cpf) };'), { cpf: '529.982.247-25' });
    expect(typeof out.ok).toBe('boolean');
  });
});
