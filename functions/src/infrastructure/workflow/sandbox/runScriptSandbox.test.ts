import { describe, it, expect } from 'vitest';
import { runScriptSandbox } from './runScriptSandbox';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';
import type { IWorkflowQueryRepository } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IWorkflowMutationRepository } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';

const logs: string[] = [];

const makeContext = (
  input: Record<string, unknown>,
  actor?: WorkflowContext['actor'],
): WorkflowContext => ({
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
  ...(actor ? { actor } : {}),
  input,
});

const deps: WorkflowQueryDeps = {
  queryRepository: {
    queryByEquality: async () => [],
  } as unknown as IWorkflowQueryRepository,
  fetcher: {} as IWorkflowRecordFetcher,
  screenProvider: {} as IScreenDefinitionProvider,
};

const mutationDeps: WorkflowMutationDeps = {
  mutationRepository: {} as IWorkflowMutationRepository,
  screenProvider: {} as IScreenDefinitionProvider,
};

const run = (js: string, input: Record<string, unknown>, actor?: WorkflowContext['actor']) =>
  runScriptSandbox(js, input, makeContext(input, actor), deps, mutationDeps);

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
    ).rejects.toThrow(/expr\.arg\.all\.strings/);
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

  it('fn.hasPermission enxerga o ATOR da execução através da ponte host<->VM', async () => {
    const out = await run(
      wrapMain('return { pode: fn.hasPermission("finance.write"), naoPode: fn.hasPermission("finance.delete") };'),
      {},
      { userId: 'u1', name: 'Ana', photoURL: '', via: 'ui', permissions: ['finance.read', 'finance.write'] },
    );
    expect(out).toEqual({ pode: true, naoPode: false });
  });

  it('`actor` é quem disparou, na mesma forma das expressões — e `null` sem pessoa', async () => {
    const comAtor = await run(
      wrapMain('return { id: actor.id, name: actor.name, via: actor.via };'),
      {},
      { userId: 'u1', name: 'Ana', photoURL: 'p', via: 'agent', permissions: [] },
    );
    expect(comAtor).toEqual({ id: 'u1', name: 'Ana', via: 'agent' });

    const semAtor = await run(wrapMain('return { vazio: actor === null };'), {});
    expect(semAtor).toEqual({ vazio: true });
  });

  it('fn.hasPermission responde NÃO quando a execução não tem ator — nasceu de um gatilho', async () => {
    const out = await run(wrapMain('return { pode: fn.hasPermission("finance.write") };'), {});
    expect(out).toEqual({ pode: false });
  });

  it('fn.hasPermission concede tudo ao curinga do dono do escritório', async () => {
    const out = await run(
      wrapMain('return { pode: fn.hasPermission("qualquer.coisa") };'),
      {},
      { userId: 'dono', name: 'Dono', photoURL: '', via: 'ui', permissions: ['*'] },
    );
    expect(out).toEqual({ pode: true });
  });

  it('fn.isCPF valida CPF', async () => {
    const out = await run(wrapMain('return { ok: fn.isCPF(input.cpf) };'), { cpf: '529.982.247-25' });
    expect(typeof out.ok).toBe('boolean');
  });
});
