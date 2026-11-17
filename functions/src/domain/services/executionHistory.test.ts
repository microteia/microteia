import { describe, expect, it } from 'vitest';
import type { WorkflowExecution, WorkflowExecutionLogEntry } from '../entities/Workflow';
import {
  historyRetainedUntil,
  historyStartedBefore,
  isHistoryExpired,
  isHistoryPurgeTick,
  HISTORY_EDGE_LINES,
  HISTORY_MAX_BYTES,
  HISTORY_TEXT_MAX_CHARACTERS,
  HISTORY_TOO_LARGE_MESSAGE,
  bareHistoryRecord,
  historyBytes,
  historyRecord,
  seesExecutionDetail,
  trimForHistory,
} from './executionHistory';

const at = new Date('2026-11-17T12:00:00Z');

const execution = (logs: WorkflowExecutionLogEntry[], outputs: Record<string, unknown> = {}): WorkflowExecution => ({
  id: 'ex1',
  tenantId: 't1',
  workflowDefinitionId: 'wf1',
  eventId: 'e1',
  status: 'SUCCESS',
  startedAt: at,
  finishedAt: at,
  logs,
  outputs,
});

const step = (stepId: string, data: Partial<WorkflowExecutionLogEntry> = {}): WorkflowExecutionLogEntry => ({
  level: 'SUCCESS',
  message: '@core.automation/run.step.done',
  at,
  stepId,
  stepDefinitionId: 'script',
  ...data,
});

describe('trimForHistory', () => {
  it('guarda o começo do texto longo e diz quanto ficou de fora', () => {
    const text = 'a'.repeat(HISTORY_TEXT_MAX_CHARACTERS + 500);
    expect(trimForHistory(text)).toBe(`${'a'.repeat(HISTORY_TEXT_MAX_CHARACTERS)}… [+500]`);
  });

  it('não toca texto no teto, número, data nem nulo', () => {
    const text = 'b'.repeat(HISTORY_TEXT_MAX_CHARACTERS);
    expect(trimForHistory(text)).toBe(text);
    expect(trimForHistory(42)).toBe(42);
    expect(trimForHistory(at)).toBe(at);
    expect(trimForHistory(null)).toBeNull();
  });

  it('desce em objetos e listas', () => {
    const long = 'c'.repeat(HISTORY_TEXT_MAX_CHARACTERS + 1);
    const trimmed = trimForHistory({ list: [long, 'curto'], nested: { text: long } }) as {
      list: string[]; nested: { text: string };
    };
    expect(trimmed.list[0]).toMatch(/… \[\+1\]$/);
    expect(trimmed.list[1]).toBe('curto');
    expect(trimmed.nested.text).toMatch(/… \[\+1\]$/);
  });
});

describe('historyRecord', () => {
  it('corta os textos de contexto, entradas, saídas, parâmetros da mensagem e saída final', () => {
    const long = 'x'.repeat(100_000);
    const record = historyRecord(execution(
      [step('read', { contextInput: { id: 'd1' }, outputs: { text: long }, messageParams: { detail: long } }),
        step('parse', { inputs: { text: long } })],
      { text: long },
    ));
    expect(record.logs[0].outputs?.text).toHaveLength(HISTORY_TEXT_MAX_CHARACTERS + '… [+98000]'.length);
    expect(record.logs[0].messageParams?.detail).toMatch(/… \[\+98000\]$/);
    expect(record.logs[0].contextInput).toEqual({ id: 'd1' });
    expect(record.logs[1].inputs?.text).toMatch(/… \[\+98000\]$/);
    expect(record.outputs.text).toMatch(/… \[\+98000\]$/);
  });

  it('o que cabe depois do corte é gravado sem aviso', () => {
    const record = historyRecord(execution([step('a', { outputs: { ok: true } })], { ok: true }));
    expect(record.logs.map((entry) => entry.message)).not.toContain(HISTORY_TOO_LARGE_MESSAGE);
    expect(record.outputs).toEqual({ ok: true });
  });

  it('o que não cabe nem cortado fica só com as mensagens, e avisa', () => {
    const many = Array.from({ length: 120_000 }, (_, i) => `valor ${i}`);
    const record = historyRecord(execution([step('query', { outputs: { rows: many } }), step('end')], { rows: many }));
    expect(historyBytes(record)).toBeLessThanOrEqual(HISTORY_MAX_BYTES);
    expect(record.logs.map((entry) => entry.stepId)).toEqual(['query', 'end', undefined]);
    expect(record.logs[0].outputs).toBeUndefined();
    expect(record.logs.at(-1)?.message).toBe(HISTORY_TOO_LARGE_MESSAGE);
    expect(record.outputs).toEqual({});
  });
});

describe('bareHistoryRecord', () => {
  it('um laço de milhares de voltas fica com as pontas e o aviso entre elas', () => {
    const lines = Array.from({ length: 20_000 }, (_, i) => step(`s${i}`, { messageParams: { detail: 'y'.repeat(200) } }));
    const record = bareHistoryRecord(execution(lines));
    expect(record.logs).toHaveLength(HISTORY_EDGE_LINES * 2 + 1);
    expect(record.logs[0].stepId).toBe('s0');
    expect(record.logs[HISTORY_EDGE_LINES].message).toBe(HISTORY_TOO_LARGE_MESSAGE);
    expect(record.logs.at(-1)?.stepId).toBe('s19999');
    expect(historyBytes(record)).toBeLessThanOrEqual(HISTORY_MAX_BYTES);
  });

  it('um histórico curto não perde linha nem repete', () => {
    const record = bareHistoryRecord(execution([step('a', { outputs: { v: 1 } }), step('b')]));
    expect(record.logs.map((entry) => entry.stepId)).toEqual(['a', 'b', undefined]);
  });
});

describe('seesExecutionDetail', () => {
  it('quem gerencia automações vê o detalhe de qualquer execução', () => {
    expect(seesExecutionDetail(['automation.manage'], 'u2', { actorId: 'u1' })).toBe(true);
    expect(seesExecutionDetail(['automation.manage'], 'u2', {})).toBe(true);
  });

  it('quem só executa vê o detalhe da execução que disparou, e de nenhuma outra', () => {
    expect(seesExecutionDetail(['automation.run'], 'u1', { actorId: 'u1' })).toBe(true);
    expect(seesExecutionDetail(['automation.run'], 'u2', { actorId: 'u1' })).toBe(false);
  });

  it('execução sem pessoa por trás (relógio, gatilho do kernel) só abre a quem gerencia', () => {
    expect(seesExecutionDetail(['automation.run'], '', {})).toBe(false);
  });
});

describe('retenção do histórico', () => {
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it('conta 90 dias do fim da execução', () => {
    expect(historyRetainedUntil({ startedAt: day('2026-01-01'), finishedAt: day('2026-01-02') }))
      .toEqual(day('2026-04-02'));
  });

  it('a execução que espera conta da hora de continuar, e não do começo', () => {
    const waiting = { startedAt: day('2026-01-01'), resumeAt: day('2026-12-01') };
    expect(isHistoryExpired(waiting, day('2026-06-01'))).toBe(false);
    expect(isHistoryExpired(waiting, day('2027-03-01'))).toBe(true);
  });

  it('a que esperou muito e terminou ontem fica mais 90 dias, ainda que tenha começado há um ano', () => {
    const resumed = { startedAt: day('2025-11-01'), resumeAt: day('2026-11-15'), finishedAt: day('2026-11-16') };
    expect(isHistoryExpired(resumed, day('2026-11-17'))).toBe(false);
  });

  it('o limite da consulta é o próprio instante do vencimento — a consulta inclui o limite', () => {
    const now = day('2026-11-17');
    expect(historyStartedBefore(now)).toEqual(day('2026-08-19'));
    expect(isHistoryExpired({ startedAt: historyStartedBefore(now) }, now)).toBe(true);
    expect(isHistoryExpired({ startedAt: new Date(historyStartedBefore(now).getTime() + 1) }, now)).toBe(false);
  });
});

describe('isHistoryPurgeTick', () => {
  it('uma passada do relógio por hora — a do primeiro intervalo', () => {
    const ticks = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 10, 17, 9, i * 5 + 2)));
    expect(ticks.filter(isHistoryPurgeTick)).toHaveLength(1);
    expect(isHistoryPurgeTick(new Date(Date.UTC(2026, 10, 17, 9, 0, 1)))).toBe(true);
  });
});
