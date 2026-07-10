import { describe, it, expect } from 'vitest';
import { ProjudiTJBAEmailParser } from './ProjudiTJBAEmailParser';
import { PROJUDI_TEXT } from './__fixtures__/emails';

describe('ProjudiTJBAEmailParser', () => {
  const parser = new ProjudiTJBAEmailParser();

  it('tem o nome correto', () => {
    expect(parser.name).toBe('ProjudiTJBA');
  });

  it('extrai os dados do e-mail real do Projudi (uma intimação)', () => {
    const results = parser.tryParse(PROJUDI_TEXT);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.processNumber).toBe('0070169-09.2014.8.05.0001');
    expect(r.court).toBe('2ª VSJE DO CONSUMIDOR (IMBUÍ VESPERTINO)');
    expect(r.legalClass).toBe('Procedimento do Juizado Especial Cível');
    expect(r.activeParty).toBe('ALEXNALDO CARVALHO DOS SANTOS');
    expect(r.passiveParty).toBe('ACESSO SOLUCOES DE PAGAMENTO LTDA, BOMPRECO BAHIA SUPERMERCADOS LTDA');
    expect(r.processSubject).toBe('Processo Despachado');

    expect(r.filingDate?.getFullYear()).toBe(2014);
    expect(r.filingDate?.getMonth()).toBe(6);
    expect(r.filingDate?.getDate()).toBe(28);

    expect(r.movements?.[0].type).toBe('Decurso de Prazo');
    expect(r.movements?.[0].date.getMonth()).toBe(10);
    expect(r.movements?.[0].date.getDate()).toBe(4);
    expect(r.parsingError).toBeUndefined();
  });

  it('retorna array vazio para e-mail não-Projudi', () => {
    expect(parser.tryParse('Mensagem qualquer sem processo.')).toEqual([]);
  });
});
