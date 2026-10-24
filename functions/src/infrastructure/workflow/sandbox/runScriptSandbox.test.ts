import { describe, it, expect } from 'vitest';
import { runScriptSandbox } from './runScriptSandbox';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';
import type { IWorkflowQueryRepository } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IWorkflowMutationRepository } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import {
  businessCalendarOf,
  createBusinessCalendarSet,
  type BusinessCalendarSet,
} from '../../../domain/schema/time/businessDays';

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

  it('fn.formatDate escreve a hora no relógio do escritório, e não no UTC do servidor', async () => {
    const input = { sentAt: new Date('2026-07-12T02:00:00.000Z') };
    const context = makeContext(input);
    const out = await runScriptSandbox(
      wrapMain('return { d: fn.formatDate(input.sentAt, "DD/MM/YYYY HH:mm") };'),
      input,
      { ...context, services: { ...context.services, timeZone: 'America/Sao_Paulo' } },
      deps,
      mutationDeps,
    );
    expect(out.d).toBe('11/07/2026 23:00');
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

describe('runScriptSandbox — contas de dias úteis (fn.addBusinessDays e irmãs)', () => {
  const calendars = createBusinessCalendarSet([
    businessCalendarOf('cal-1', {
      key: 'national',
      name: 'National',
      weekend: [0, 6],
      years: { '2026': ['2026-04-03', '2026-04-21'] },
    }),
  ]);

  const runWith = (js: string, input: Record<string, unknown>, businessCalendars: BusinessCalendarSet | null) => {
    const context = makeContext(input);
    return runScriptSandbox(
      js,
      input,
      { ...context, services: { ...context.services, timeZone: 'America/Sao_Paulo', businessCalendars } },
      deps,
      mutationDeps,
    );
  };

  it('conta pelos calendários da execução, e o Date atravessa a ponte nos dois sentidos', async () => {
    const out = await runWith(
      wrapMain(`
        const due = fn.addBusinessDays(input.start, 1, "national");
        return {
          due: fn.formatDate(due, "YYYY-MM-DD"),
          between: fn.businessDaysBetween(input.start, due, ["national"]),
          holiday: fn.isBusinessDay("2026-04-21", "national"),
          next: fn.formatDate(fn.nextBusinessDay("2026-04-04", "national"), "YYYY-MM-DD"),
        };`),
      { start: new Date('2026-04-02T12:00:00.000Z') },
      calendars,
    );
    expect(out).toEqual({ due: '2026-04-06', between: 1, holiday: false, next: '2026-04-06' });
  });

  it('calendário inexistente REJEITA o Script nomeando a recusa — nunca conta sem os dias', async () => {
    await expect(
      runWith(wrapMain('return { due: fn.addBusinessDays("2026-04-02", 1, "state") };'), {}, calendars),
    ).rejects.toThrow(/business-days\.error\.not-found/);
  });

  it('sem extensão que declare calendários, a recusa é "indisponível"', async () => {
    await expect(
      runWith(wrapMain('return { ok: fn.isBusinessDay("2026-04-02", "national") };'), {}, null),
    ).rejects.toThrow(/business-days\.error\.unavailable/);
  });
});
