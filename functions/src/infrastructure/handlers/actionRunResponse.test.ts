import { describe, expect, it } from 'vitest';
import type { RunCalledWorkflowResult } from '../../domain/usecases/RunCalledWorkflowUseCase';
import { actionRunResponse } from './actionRunResponse';

const ran = (overrides: Partial<Extract<RunCalledWorkflowResult, { found: true }>> = {}): RunCalledWorkflowResult => ({
  found: true,
  status: 'SUCCESS',
  outputs: {},
  executionId: 'x1',
  failures: [],
  ...overrides,
});

describe('o que o botão lê da execução do fluxo dele', () => {
  it('o fluxo que a porta deixou de fora não é confundido com o que não devolveu nada', () => {
    expect(actionRunResponse(ran({ skipped: 'condition' }), 'Approve')).toEqual({
      outcome: null,
      executionId: 'x1',
      error: '@core.automation/handler.action.skipped',
      errorParams: { name: 'Approve' },
    });
  });

  it('o fluxo que rodou e terminou sem as três chaves continua sendo "nada voltou"', () => {
    expect(actionRunResponse(ran({ outputs: { total: 3 } }), 'Approve')).toMatchObject({
      outcome: null,
      error: '@core.automation/handler.action.no-result',
    });
  });

  it('o fluxo que responde chega ao botão como desfecho', () => {
    const response = actionRunResponse(ran({ outputs: { status: 'SUCCESS', actions: ['refresh'] } }), 'Approve');
    expect(response.error).toBeNull();
    expect(response.outcome).toMatchObject({ status: { code: 'SUCCESS' } });
    expect(response.outcome?.commands).toHaveLength(1);
  });

  it('a falha e o fluxo inexistente seguem com as frases de antes', () => {
    expect(actionRunResponse(ran({ status: 'FAILED' }), 'Approve')).toMatchObject({
      error: '@core.automation/handler.action.run-failed',
      errorParams: { name: 'Approve' },
    });
    expect(actionRunResponse({ found: false }, 'Approve')).toEqual({
      outcome: null,
      executionId: null,
      error: '@core.automation/handler.action.workflow-invalid',
    });
  });
});
