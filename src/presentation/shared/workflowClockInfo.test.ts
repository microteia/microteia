import { describe, expect, it } from 'vitest';
import { buildWorkflowClockInfo } from './workflowClockInfo';
import type { WorkflowClockInfoInput } from './workflowClockInfo';

const at = (iso: string): Date => new Date(iso);

const input = (overrides: Partial<WorkflowClockInfoInput> = {}): WorkflowClockInfoInput => ({
  kind: 'schedule',
  enabled: true,
  loaded: true,
  status: {
    nextRunAt: at('2026-10-15T20:53:00Z'),
    timeZone: 'America/Sao_Paulo',
    updatedAt: at('2026-10-14T20:55:00Z'),
    lastRun: null,
  },
  triggerPending: false,
  savedAt: at('2026-10-14T20:50:00Z'),
  now: at('2026-10-14T21:00:00Z'),
  expected: { at: at('2026-10-15T20:53:00Z'), timeZone: 'America/Sao_Paulo' },
  format: (instant) => instant.toISOString(),
  ...overrides,
});

describe('buildWorkflowClockInfo — o relógio do servidor na tela da automação', () => {
  it('mostra o próximo disparo gravado pelo servidor e que ainda não rodou', () => {
    const info = buildWorkflowClockInfo(input());
    expect(info?.warning).toBeNull();
    expect(info?.lines.map((line) => line.message)).toEqual([
      '@core.automation/workflow.clock.next',
      '@core.automation/workflow.clock.never',
    ]);
  });

  it('acusa quando o servidor vai disparar num horário diferente do que a declaração salva pede', () => {
    const info = buildWorkflowClockInfo(input({ expected: { at: at('2026-10-15T17:53:00Z'), timeZone: 'UTC' } }));
    expect(info?.warning).toEqual({
      message: '@core.automation/workflow.clock.diverges',
      messageParams: { server: '2026-10-15T20:53:00.000Z', expected: '2026-10-15T17:53:00.000Z' },
    });
  });

  it('logo depois de salvar, a divergência e a ausência não piscam enquanto o servidor recalcula', () => {
    const savedAt = at('2026-10-14T20:59:30Z');
    expect(buildWorkflowClockInfo(input({ savedAt, expected: { at: at('2026-10-16T00:00:00Z'), timeZone: 'UTC' } }))?.warning).toBeNull();
    const missing = buildWorkflowClockInfo(input({ savedAt, status: null }));
    expect(missing?.warning).toBeNull();
    expect(missing?.lines[0].message).toBe('@core.automation/workflow.clock.syncing');
  });

  it('automação ativa sem entrada no relógio é acusada', () => {
    expect(buildWorkflowClockInfo(input({ status: null }))?.warning?.message).toBe('@core.automation/workflow.clock.missing');
  });

  it('vencida e ainda não tratada diz em quanto tempo o relógio passa, sem acusar divergência', () => {
    const info = buildWorkflowClockInfo(input({ now: at('2026-10-15T20:55:00Z') }));
    expect(info?.warning).toBeNull();
    expect(info?.lines[0]).toEqual({
      message: '@core.automation/workflow.clock.due',
      messageParams: { when: '2026-10-15T20:53:00.000Z', minutes: '5' },
    });
  });

  it('o último disparo leva à execução; o pulado diz o motivo', () => {
    const fired = buildWorkflowClockInfo(input({
      status: {
        ...input().status!,
        lastRun: {
          scheduledFor: at('2026-10-14T20:53:00Z'),
          ranAt: at('2026-10-14T20:55:02Z'),
          outcome: 'fired',
          skipReason: null,
          eventId: 'clock_wf_1',
          records: null,
        },
      },
    }));
    expect(fired?.lines[1].message).toBe('@core.automation/workflow.clock.last-fired');
    expect(fired?.lastRunEventId).toBe('clock_wf_1');

    const skipped = buildWorkflowClockInfo(input({
      status: {
        ...input().status!,
        lastRun: {
          scheduledFor: at('2026-10-14T20:53:00Z'),
          ranAt: at('2026-10-14T20:55:02Z'),
          outcome: 'skipped',
          skipReason: 'owners-deactivated',
          eventId: null,
          records: null,
        },
      },
    }));
    expect(skipped?.lines[1].message).toBe('@core.automation/workflow.clock.skipped.owners-deactivated');
    expect(skipped?.lastRunEventId).toBeNull();
  });

  it('inativa diz que o relógio não a executa, sem esperar a leitura', () => {
    const info = buildWorkflowClockInfo(input({ enabled: false, loaded: false }));
    expect(info?.lines.map((line) => line.message)).toEqual(['@core.automation/workflow.clock.inactive']);
  });

  it('avisa que a alteração não salva do gatilho ainda não vale no servidor', () => {
    const info = buildWorkflowClockInfo(input({ triggerPending: true }));
    expect(info?.lines.at(-1)?.message).toBe('@core.automation/workflow.clock.pending');
  });
});
