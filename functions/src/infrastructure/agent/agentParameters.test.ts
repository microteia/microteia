import { describe, expect, it } from 'vitest';
import type { WorkflowParameter } from '../../domain/entities/Workflow';
import { prepareParameters } from './agentParameters';

const PARAMETERS: WorkflowParameter[] = [
  { key: 'code', label: 'Code', type: 'String', required: true },
  { key: 'amount', label: 'Amount', type: 'Number' },
  { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'first', label: 'First' }] },
  { key: 'startsOn', label: 'Starts on', type: 'Date' },
];

/**
 * O caso que motivou a conferência: o agente mandou chaves que a automação não declara, o motor as
 * descartou, e a execução terminou SUCCESS sem ter recebido nada. Agora a recusa vem ANTES de
 * publicar, e diz quais chaves existem.
 */
describe('prepareParameters — nada começa com parâmetro errado', () => {
  it('recusa a chave desconhecida e lista as aceitas', () => {
    const prepared = prepareParameters(PARAMETERS, { codigo: 'X-1' });
    expect(prepared).toEqual({
      ok: false,
      kind: 'unknown',
      unknown: ['codigo'],
      accepted: ['code', 'amount', 'kind', 'startsOn'],
    });
  });

  it('recusa o obrigatório ausente antes de publicar, e não depois, dentro do motor', () => {
    const prepared = prepareParameters(PARAMETERS, { amount: 3 });
    expect(prepared.ok).toBe(false);
    if (prepared.ok || prepared.kind !== 'invalid') throw new Error('esperava recusa de valor');
    expect(prepared.issues.map((issue) => [issue.path, issue.error])).toEqual([
      ['code', '@core.automation/parameter.required'],
    ]);
  });

  it('o valor que não converte é recusado, em vez de virar nulo calado', () => {
    const prepared = prepareParameters(PARAMETERS, { code: 'X', amount: 'muitos', kind: 'third' });
    if (prepared.ok || prepared.kind !== 'invalid') throw new Error('esperava recusa de valor');
    expect(prepared.issues.map((issue) => issue.path)).toEqual(['amount', 'kind']);
  });

  it('converte ao tipo declarado: o dia vira data na âncora de meio-dia', () => {
    const prepared = prepareParameters(PARAMETERS, { code: 'X', amount: '12', startsOn: '2026-10-01' });
    if (!prepared.ok) throw new Error('esperava sucesso');
    expect(prepared.data.amount).toBe(12);
    expect((prepared.data.startsOn as Date).toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('os valores do sistema contam para a obrigatoriedade, não para o nome', () => {
    const parameters: WorkflowParameter[] = [{ key: 'recordId', label: 'Record', type: 'String', required: true }];
    expect(prepareParameters(parameters, {}, { recordId: 'r1', isNew: false }).ok).toBe(true);
    expect(prepareParameters([], { isNew: true }, { isNew: false }).ok).toBe(true);
  });
});
