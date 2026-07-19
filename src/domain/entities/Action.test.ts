import { describe, expect, it } from 'vitest';
import { normalizeActionOutcome } from './Action';

describe('normalizeActionOutcome', () => {
  it('lê o contrato completo do workflow', () => {
    const outcome = normalizeActionOutcome({
      result: { email: 'a@b.com' },
      status: { code: 'SUCCESS', message: 'Feito' },
      actions: ['merge', 'save'],
    });
    expect(outcome.result).toEqual({ email: 'a@b.com' });
    expect(outcome.status).toEqual({ code: 'SUCCESS', message: 'Feito' });
    expect(outcome.commands).toEqual(['merge', 'save']);
  });

  it('reordena os comandos para a ordem canônica', () => {
    const outcome = normalizeActionOutcome({ actions: ['close', 'save', 'merge'] });
    expect(outcome.commands).toEqual(['merge', 'save', 'close']);
  });

  it('aceita comandos na forma de objeto e descarta os desconhecidos', () => {
    const outcome = normalizeActionOutcome({
      actions: [{ type: 'merge' }, 'voar', { type: 'save' }, 42, null],
    });
    expect(outcome.commands).toEqual(['merge', 'save']);
  });

  it('remove comandos repetidos', () => {
    expect(normalizeActionOutcome({ actions: ['save', 'save'] }).commands).toEqual(['save']);
  });

  it('normaliza caixa e espaços do comando e do código de status', () => {
    const outcome = normalizeActionOutcome({
      actions: ['  MERGE '],
      status: { code: ' warning ', message: '  Atenção  ' },
    });
    expect(outcome.commands).toEqual(['merge']);
    expect(outcome.status).toEqual({ code: 'WARNING', message: 'Atenção' });
  });

  it('cai para SUCCESS quando o código é desconhecido, sem promovê-lo a mensagem', () => {
    const status = normalizeActionOutcome({ status: { code: 'BOOM' } }).status;
    expect(status).toEqual({ code: 'SUCCESS', message: '' });
  });

  it('aceita o status como par [código, mensagem]', () => {
    expect(normalizeActionOutcome({ status: ['ERROR', 'Falhou'] }).status)
      .toEqual({ code: 'ERROR', message: 'Falhou' });
  });

  it('aceita o status como texto só com o código', () => {
    expect(normalizeActionOutcome({ status: 'warning' }).status)
      .toEqual({ code: 'WARNING', message: '' });
    expect(normalizeActionOutcome({ status: ['SUCCESS'] }).status)
      .toEqual({ code: 'SUCCESS', message: '' });
  });

  it('trata texto que não é um código como mensagem de sucesso', () => {
    expect(normalizeActionOutcome({ status: 'Enviado com sucesso' }).status)
      .toEqual({ code: 'SUCCESS', message: 'Enviado com sucesso' });
    expect(normalizeActionOutcome({ status: ['Enviado'] }).status)
      .toEqual({ code: 'SUCCESS', message: 'Enviado' });
  });

  it('normaliza caixa e espaços também nas formas compactas', () => {
    expect(normalizeActionOutcome({ status: [' error ', '  Falhou  '] }).status)
      .toEqual({ code: 'ERROR', message: 'Falhou' });
  });

  it('mantém apenas mensagens de erro de campo não vazias', () => {
    const outcome = normalizeActionOutcome({
      status: { code: 'ERROR', message: 'x', fieldErrors: { email: ' inválido ', nome: '', cpf: 7 } },
    });
    expect(outcome.status.fieldErrors).toEqual({ email: 'inválido' });
  });

  it('omite fieldErrors quando nenhuma mensagem sobrevive', () => {
    const outcome = normalizeActionOutcome({ status: { fieldErrors: { email: '' } } });
    expect(outcome.status.fieldErrors).toBeUndefined();
  });

  it('devolve um resultado neutro para saídas ausentes ou malformadas', () => {
    for (const input of [undefined, null, 'texto', 42, [], { result: 'nao-e-objeto' }]) {
      const outcome = normalizeActionOutcome(input);
      expect(outcome.result).toBeNull();
      expect(outcome.commands).toEqual([]);
      expect(outcome.status).toEqual({ code: 'SUCCESS', message: '' });
    }
  });
});
