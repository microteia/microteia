import { describe, it, expect } from 'vitest';
import { decodePartData } from './GmailService';
import { TJBAEmailParser } from './parsers/TJBAEmailParser';
import { PJE_PUSH_TJBA_HTML } from './parsers/__fixtures__/emails';

const gmailPart = (body: Buffer, contentType: string) => ({
  mimeType: 'text/html',
  headers: [{ name: 'Content-Type', value: contentType }],
  body: { data: body.toString('base64url') },
});

describe('decodePartData', () => {
  it('decodifica como UTF-8 mesmo quando a parte declara ISO-8859-1', () => {
    const part = gmailPart(Buffer.from('Número do Processo', 'utf8'), 'text/html; charset=ISO-8859-1');
    expect(decodePartData(part)).toBe('Número do Processo');
  });

  it('cai para latin1 quando os bytes não são UTF-8 válido', () => {
    const part = gmailPart(Buffer.from('Número do Processo', 'latin1'), 'text/html; charset=ISO-8859-1');
    expect(decodePartData(part)).toBe('Número do Processo');
  });

  it('preserva "=" seguido de hexadecimal em URLs', () => {
    const url = 'documentoHTML.seam?idBin=541457660&idProcessoDoc=569250351';
    const part = gmailPart(Buffer.from(url, 'utf8'), 'text/html; charset=UTF-8');
    expect(decodePartData(part)).toBe(url);
  });
});

describe('e-mail real do PJe Push TJBA entregue pela Gmail API', () => {
  const part = gmailPart(Buffer.from(PJE_PUSH_TJBA_HTML, 'utf8'), 'text/html; charset=ISO-8859-1');

  it('é reconhecido e parseado após a decodificação da parte MIME', () => {
    const results = new TJBAEmailParser().tryParse('', decodePartData(part));

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.parsingError).toBeUndefined();
    expect(r.processNumber).toBe('8158805-57.2024.8.05.0001');
    expect(r.activeParty).toBe('ALEXNALDO CARVALHO DOS SANTOS, ALANE CRISTINA CARVALHO BARROS');
    expect(r.passiveParty).toBe('COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA COELBA');
    expect(r.legalClass).toBe('PROCEDIMENTO COMUM CÍVEL');
    expect(r.court).toBe('17ª VARA DE RELAÇÕES DE CONSUMO DA COMARCA DE SALVADOR');
    expect(r.distributionType).toBe('sorteio');
    expect(r.processSubject).toBe('Obrigação de Fazer / Não Fazer');
    expect(r.filingDate?.getDate()).toBe(29);
    expect(r.filingDate?.getMonth()).toBe(9);
    expect(r.filingDate?.getFullYear()).toBe(2024);

    expect(r.movements).toHaveLength(1);
    expect(r.movements?.[0].type).toBe('Disponibilizado no DJ Eletrônico em 17/07/2026');
    expect(r.movements?.[0].date.getDate()).toBe(18);
    expect(r.movements?.[0].documentUrl).toContain('idBin=541457660');
    expect(r.movements?.[0].documentUrl).toContain('idProcessoDoc=569250351');
  });

  it('não extrai o processo quando o corpo UTF-8 é lido como latin1', () => {
    const corrompido = Buffer.from(PJE_PUSH_TJBA_HTML, 'utf8').toString('latin1');
    const results = new TJBAEmailParser().tryParse('', corrompido);

    expect(results[0]?.processNumber).toBeUndefined();
    expect(results[0]?.parsingError).toBe('Número do processo não encontrado');
  });
});
