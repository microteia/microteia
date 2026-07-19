import { describe, it, expect } from 'vitest';
import { decodePartData } from './GmailService';
import { decodeQuotedPrintable } from './mimeDecoding';
import { TJBAEmailParser } from './parsers/TJBAEmailParser';
import { PJE_PUSH_QUOTED_PRINTABLE_HTML } from './parsers/__fixtures__/emails';

const gmailPart = (body: string, contentType: string, transferEncoding?: string) => ({
  mimeType: 'text/html',
  headers: [
    { name: 'Content-Type', value: contentType },
    ...(transferEncoding ? [{ name: 'Content-Transfer-Encoding', value: transferEncoding }] : []),
  ],
  body: { data: Buffer.from(body, 'latin1').toString('base64url') },
});

describe('decodeQuotedPrintable', () => {
  it('remove quebras de linha suaves', () => {
    expect(decodeQuotedPrintable(Buffer.from('Numero do proces=\r\nso', 'latin1')).toString('latin1')).toBe(
      'Numero do processo',
    );
  });

  it('converte escapes =XX no byte correspondente', () => {
    expect(decodeQuotedPrintable(Buffer.from('N=FAmero', 'latin1')).toString('latin1')).toBe('Número');
  });

  it('preserva o texto que não está codificado', () => {
    expect(decodeQuotedPrintable(Buffer.from('Classe Judicial: X', 'latin1')).toString('latin1')).toBe(
      'Classe Judicial: X',
    );
  });
});

describe('decodePartData', () => {
  it('decodifica quoted-printable antes de aplicar o charset ISO-8859-1', () => {
    const part = gmailPart('N=FAmero do Proces=\r\nso: 1', 'text/html; charset=ISO-8859-1', 'quoted-printable');
    expect(decodePartData(part)).toBe('Número do Processo: 1');
  });

  it('não altera partes sem quoted-printable', () => {
    const part = gmailPart('Número do Processo: 1', 'text/html; charset=ISO-8859-1');
    expect(decodePartData(part)).toBe('Número do Processo: 1');
  });
});

describe('e-mail real do PJe TJBA em quoted-printable (pjetjba.eml)', () => {
  const part = gmailPart(
    PJE_PUSH_QUOTED_PRINTABLE_HTML,
    'text/html; charset=ISO-8859-1',
    'quoted-printable',
  );

  it('é reconhecido e parseado pelo TJBAEmailParser após a decodificação MIME', () => {
    const html = decodePartData(part);
    const results = new TJBAEmailParser().tryParse('', html);

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
    expect(r.movements?.[0].documentUrl).toContain('documentoHTML.seam?idBin=541457660');
  });

  it('não é reconhecido enquanto o quoted-printable não for decodificado', () => {
    const results = new TJBAEmailParser().tryParse('', PJE_PUSH_QUOTED_PRINTABLE_HTML);
    expect(results).toEqual([]);
  });
});
