import { describe, it, expect } from 'vitest';
import { reportCsvFileName, reportResultToCsv } from './reportCsv';

describe('reportResultToCsv', () => {
  it('começa com o BOM — sem ele o Excel come todo acento', () => {
    const csv = reportResultToCsv({ header: ['Situação'], rows: [['Pagó']] });

    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('Situação');
  });

  it('põe entre aspas o valor com vírgula, aspas ou quebra de linha', () => {
    const csv = reportResultToCsv({
      header: ['Cliente', 'Nota'],
      rows: [
        ['Silva, Ana', 'diz "ok"'],
        ['Bruno', 'linha 1\nlinha 2'],
      ],
    });

    expect(csv).toContain('"Silva, Ana","diz ""ok"""');
    expect(csv).toContain('"linha 1\nlinha 2"');
  });

  it('separa as linhas com CRLF, como manda a RFC 4180', () => {
    const csv = reportResultToCsv({ header: ['a'], rows: [['1'], ['2']] });

    expect(csv.slice(1)).toBe('a\r\n1\r\n2');
  });

  it('leva a linha de total quando ela existe', () => {
    const csv = reportResultToCsv({ header: ['x', 'y'], rows: [['a', '1']], totals: ['Total', '1'] });

    expect(csv.trimEnd().endsWith('Total,1')).toBe(true);
  });

  it('põe o total num bloco à parte quando ele não tem as colunas do corpo', () => {
    // A lista simples mostra campos do registro no corpo e números agregados no total: alinhados,
    // a soma cairia debaixo da coluna "Cliente" — um número plausível lido como outra coisa.
    const csv = reportResultToCsv({
      header: ['Cliente', 'Contrato'],
      rows: [['Ana', 'A-1'], ['Bruno', 'B-2']],
      totalsHeader: ['', 'Faturamento'],
      totals: ['Total', '3000'],
    });

    expect(csv.slice(1).split('\r\n')).toEqual([
      'Cliente,Contrato',
      'Ana,A-1',
      'Bruno,B-2',
      '',
      ',Faturamento',
      'Total,3000',
    ]);
  });

  it('diz NO ARQUIVO que o resultado é parcial', () => {
    // A planilha viaja por e-mail e sobrevive à tela: se o aviso ficasse só no banner, o número
    // parcial chegaria ao destinatário sem nada dizendo que é parcial.
    const csv = reportResultToCsv({
      header: ['x'],
      rows: [['1']],
      notice: 'Resultado parcial: 2000 registros cobertos.',
    });

    expect(csv.slice(1).split('\r\n')[0]).toBe('Resultado parcial: 2000 registros cobertos.');
  });
});

describe('reportCsvFileName', () => {
  it('monta um nome com o título e o dia', () => {
    expect(reportCsvFileName('Faturamento por sócio', new Date('2026-03-08T12:00:00Z')))
      .toBe('faturamento-por-sócio-2026-03-08.csv');
  });

  it('não deixa o nome vazio quando o título não tem letra nem número', () => {
    expect(reportCsvFileName('***', new Date('2026-03-08T12:00:00Z'))).toBe('relatorio-2026-03-08.csv');
  });
});
