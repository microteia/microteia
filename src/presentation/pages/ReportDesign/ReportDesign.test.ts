import { describe, it, expect } from 'vitest';
import {
  MEASURE_COUNT_KEY,
  movedDimensions,
  operatorNeedsValue,
  uniqueReportKey,
  withGranularity,
} from './ReportDesign.viewmodel';
import type { ReportDimension } from '../../../domain/schema/report/reportSpec';

/**
 * A chave do DOCUMENTO, e o defeito que chegou à tela.
 *
 * Salvar um segundo relatório com o mesmo nome devolvia `artifact.id-taken` — recusa correta do
 * repositório e inútil para quem só quis repetir o nome. O nome é do escritório; a chave é do
 * sistema, e é ela que precisa ceder.
 */
describe('uniqueReportKey', () => {
  it('deriva uma chave legível do nome', () => {
    expect(uniqueReportKey('Faturamento por sócio', new Set())).toBe('faturamento_por_s_cio');
  });

  it('desvia da chave que já existe, em vez de recusar', () => {
    const taken = new Set(['listagem_de_pessoas']);

    expect(uniqueReportKey('Listagem de Pessoas', taken)).toBe('listagem_de_pessoas_2');
  });

  it('continua desviando quando o desvio também está ocupado', () => {
    const taken = new Set(['mensal', 'mensal_2', 'mensal_3']);

    expect(uniqueReportKey('mensal', taken)).toBe('mensal_4');
  });

  it('não devolve chave vazia quando o nome não tem letra nem número', () => {
    // E o padrão é DESTE chamador: um padrão compartilhado com a chave de campo fazia a chave de um
    // relatório sair `campo`, que é nome interno de outra coisa.
    expect(uniqueReportKey('***', new Set())).toBe('report');
  });

  it('corta um nome longo, e o corte não gera colisão silenciosa', () => {
    const longo = 'a'.repeat(200);
    const primeira = uniqueReportKey(longo, new Set());

    expect(primeira.length).toBeLessThanOrEqual(60);
    expect(uniqueReportKey(longo, new Set([primeira]))).toBe(`${primeira}_2`);
  });
});

/**
 * A CHAVE não se traduz.
 *
 * `contagem` foi gravado como chave de medida num relatório real — palavra nossa dentro de um
 * identificador, que é o que viaja no `.json` exportado e o que a dobra referencia. O que traduz é o
 * `label`, e é ele que a tela mostra.
 */
describe('a chave de uma medida', () => {
  it('a contagem se chama `count`, e não `contagem`', () => {
    // Guardado pelo catálogo: se alguém trocar a chave por uma palavra traduzida outra vez, o par
    // rótulo/chave deixa de existir e nada mais reprova.
    expect(MEASURE_COUNT_KEY).toBe('count');
  });
});

/**
 * O operador que NÃO pede valor.
 *
 * `está preenchido` responde sobre a presença do campo, não sobre o conteúdo dele. Pedir um valor ali
 * seria cobrar da pessoa o que a consulta ignora — e o valor digitado sumiria sem explicação.
 */
describe('operatorNeedsValue', () => {
  it('exists dispensa valor', () => {
    expect(operatorNeedsValue('exists')).toBe(false);
  });

  it('todos os outros pedem', () => {
    for (const op of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'contains'] as const) {
      expect(operatorNeedsValue(op), op).toBe(true);
    }
  });
});

/**
 * "Valor exato" REMOVE o corte, em vez de o gravar `undefined`.
 *
 * O defeito chegou à tela como uma recusa do SDK do Firestore — `Unsupported field value:
 * undefined (found in document tenants/.../reports/...)` —, dita sobre um documento que quem estava
 * desenhando o relatório nunca viu. O `spec` é gravado verbatim, então um `undefined` dentro dele
 * derruba a gravação inteira.
 */
describe('withGranularity', () => {
  const dimensions: ReportDimension[] = [
    { key: 'venc', path: 'dueDate', granularity: 'month' },
    { key: 'tipo', path: 'kind' },
  ];

  it('valor exato apaga a chave, e não a deixa como undefined', () => {
    const [venc] = withGranularity(dimensions, 'venc', undefined);

    expect('granularity' in venc).toBe(false);
    // A prova do defeito: `JSON.stringify` esconderia um `undefined`, o Firestore não.
    expect(Object.values(venc).includes(undefined)).toBe(false);
  });

  it('trocar de corte grava o corte novo', () => {
    expect(withGranularity(dimensions, 'venc', 'quarter')[0].granularity).toBe('quarter');
  });

  it('quem tem outra chave não é tocado', () => {
    expect(withGranularity(dimensions, 'venc', undefined)[1]).toBe(dimensions[1]);
  });
});

/**
 * A ORDEM dos agrupamentos é o relatório: ela é a ordem dos níveis do resumo e a das colunas da
 * lista simples. Sem reordenar, trocar dois de lugar exigia remover os dois e declará-los de novo.
 */
describe('movedDimensions', () => {
  const dimensions: ReportDimension[] = [
    { key: 'a', path: 'a' },
    { key: 'b', path: 'b' },
    { key: 'c', path: 'c' },
  ];
  const keys = (list: ReportDimension[] | null): string[] => (list ?? []).map((one) => one.key);

  it('sobe uma posição', () => {
    expect(keys(movedDimensions(dimensions, 'c', 1))).toEqual(['a', 'c', 'b']);
  });

  it('arrastar para o topo leva o item para o topo', () => {
    expect(keys(movedDimensions(dimensions, 'c', 0))).toEqual(['c', 'a', 'b']);
  });

  it('fora da lista nada muda — o botão da ponta não pode inventar uma posição', () => {
    expect(movedDimensions(dimensions, 'a', -1)).toBeNull();
    expect(movedDimensions(dimensions, 'c', 3)).toBeNull();
    expect(movedDimensions(dimensions, 'z', 0)).toBeNull();
  });
});
