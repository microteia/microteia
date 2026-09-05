import { describe, it, expect } from 'vitest';
import { bucketDateValue } from './reportBuckets';

describe('bucketDateValue', () => {
  it('corta o balde no fuso pedido, e não em UTC', () => {
    // 31/03 às 23:30 em São Paulo é 01/04 às 02:30 em UTC. Em UTC a venda cairia em ABRIL — um mês
    // inteiro de faturamento no balde errado, e ninguém olhando o total tem como notar.
    const instant = new Date('2026-04-01T02:30:00.000Z');

    expect(bucketDateValue(instant, 'month', 'America/Sao_Paulo')).toBe('2026-03');
    expect(bucketDateValue(instant, 'month', 'UTC')).toBe('2026-04');
  });

  it('lê um texto AAAA-MM-DD ao pé da letra, sem converter de fuso', () => {
    // Uma data civil não tem instante. Convertê-la faria o dia 1º virar o dia 31 do mês anterior.
    expect(bucketDateValue('2026-03-01', 'month', 'America/Sao_Paulo')).toBe('2026-03');
    expect(bucketDateValue('2026-03-01', 'day', 'America/Sao_Paulo')).toBe('2026-03-01');
  });

  it('devolve as cinco granularidades em chaves ordenáveis como texto', () => {
    const value = '2026-08-13';

    expect(bucketDateValue(value, 'day', 'UTC')).toBe('2026-08-13');
    expect(bucketDateValue(value, 'week', 'UTC')).toBe('2026-W33');
    expect(bucketDateValue(value, 'month', 'UTC')).toBe('2026-08');
    expect(bucketDateValue(value, 'quarter', 'UTC')).toBe('2026-Q3');
    expect(bucketDateValue(value, 'year', 'UTC')).toBe('2026');
  });

  it('ordena cronologicamente na comparação de textos', () => {
    const keys = ['2026-10', '2026-02', '2025-12'].sort();
    expect(keys).toEqual(['2025-12', '2026-02', '2026-10']);
  });

  it('põe 1º de janeiro na última semana do ano anterior quando a semana ISO manda', () => {
    // 2027-01-01 é uma sexta: pela ISO 8601 ela pertence à semana 53 de 2026.
    expect(bucketDateValue('2027-01-01', 'week', 'UTC')).toBe('2026-W53');
  });

  it('devolve null para o que não é data — quem chama agrupa pelo valor cru', () => {
    expect(bucketDateValue('pendente', 'month', 'UTC')).toBeNull();
    expect(bucketDateValue(null, 'month', 'UTC')).toBeNull();
    expect(bucketDateValue(undefined, 'day', 'UTC')).toBeNull();
  });

  it('uma LISTA de datas tem um balde por item', () => {
    // É o que um caminho colhe de uma referência de vários. Sem isto, o balde não se aplicava e o
    // agrupamento caía na data inteira — o corte pedido ignorado, sem uma palavra na tela.
    expect(bucketDateValue(['2026-03-14', '2026-08-02'], 'month', 'UTC')).toBe('2026-03,2026-08');
    expect(bucketDateValue([], 'month', 'UTC')).toBeNull();
    expect(bucketDateValue(['2026-03-14', 'pendente'], 'month', 'UTC')).toBeNull();
  });

  it('cai em UTC quando o fuso declarado é inválido, em vez de derrubar o relatório', () => {
    expect(bucketDateValue(new Date('2026-04-01T02:30:00.000Z'), 'month', 'Nao/Existe')).toBe('2026-04');
  });
});
