import { describe, it, expect } from 'vitest';
import { RecorteDigitalEmailParser } from './RecorteDigitalEmailParser';
import { RECORTE_HTML } from './__fixtures__/emails';

describe('RecorteDigitalEmailParser', () => {
  const parser = new RecorteDigitalEmailParser();

  it('tem o nome correto', () => {
    expect(parser.name).toBe('RECORTE_DIGITAL');
  });

  it('extrai as duas publicações do e-mail real do Recorte Digital', () => {
    const results = parser.tryParse('', RECORTE_HTML);
    expect(results).toHaveLength(2);
  });

  it('extrai os campos da primeira publicação', () => {
    const [first] = parser.tryParse('', RECORTE_HTML);
    expect(first.processNumber).toBe('0007042-77.2026.8.05.0001');
    expect(first.legalClass).toBe('CUMPRIMENTO DE SENTENcA');
    expect(first.court).toBe('9ª VSJE DO CONSUMIDOR (MATUTINO)');
    expect(first.activeParty).toBe('PAULO MATEUS DE JESUS DOS SANTOS');
    expect(first.passiveParty).toBeUndefined();
    expect(first.movements?.[0].documentUrl).toBe(
      'https://projudi.tjba.jus.br/projudi/acoes/VisualizaIntimacaoDJENCNJExterno?codigoHash=27C56744',
    );
    expect(first.movements?.[0].description).toContain('Proferido despacho de mero expediente');
  });

  it('extrai os campos da segunda publicação (múltiplos polos)', () => {
    const [, second] = parser.tryParse('', RECORTE_HTML);
    expect(second.processNumber).toBe('8122422-12.2026.8.05.0001');
    expect(second.legalClass).toBe('Regulamentacao de Visitas');
    expect(second.court).toBe('9ª VARA DE FAMILIA DA COMARCA DE SALVADOR');
    expect(second.activeParty).toBe('A. C. D. S., A. S. B.');
    expect(second.passiveParty).toContain('MINISTeRIO PuBLICO DO ESTADO DA BAHIA');
    expect(second.movements?.[0].documentUrl).toContain('pje.tjba.jus.br');
  });

  it('retorna array vazio para e-mail sem os marcadores', () => {
    expect(parser.tryParse('', '<html><body>sem publicações</body></html>')).toEqual([]);
  });
});
