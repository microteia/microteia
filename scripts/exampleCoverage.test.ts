import { describe, expect, it } from 'vitest';
import {
  exampleCoverage,
  exampleCoverageGaps,
  exampleCoverageSummary,
} from '../src/sdk/domain/exampleCoverage';
import { ALL_TRAVELLING_EXAMPLES } from '../src/plugins/marketplace/travellingExamples';
import { EXAMPLE_SOURCES } from '../cli/src/vendor/exampleSources.js';
import { EXAMPLE_NOTES } from '../src/sdk/node/exampleNotes';

/**
 * O QUE NENHUM EXEMPLO ENSINA — e o dia em que essa lista cresce sem ninguém notar.
 *
 * A coletânea ficou completa num dia; o problema é o dia seguinte. Um ponto de extensão novo, ou uma
 * chave nova de pacote, entra sem material de leitura e nada acusa — foi exatamente assim que seis
 * exemplos passaram a cobrir seis dos vinte e dois pontos sem que nenhum arquivo dissesse quais
 * dezesseis faltavam.
 *
 * A tabela abaixo é a lista das lacunas RECONHECIDAS, na mesma disciplina de `VERSAO_CONFERIDA`: uma
 * lacuna nova reprova aqui, e fechá-la é escrever o exemplo OU acrescentar a linha dizendo por que ela
 * fica. As duas são decisões; o que não é decisão é a lacuna aparecer sozinha.
 */
const LACUNAS_RECONHECIDAS: Record<string, string> = {
  'package-artifact/backendSource':
    'a fonte das Cloud Functions. Ninguém a escreve no plugin.ts: o build a acopla a partir de functions/ ao '
    + 'lado dele, e por isso o objeto em memória do exemplo nunca a tem. O backend-example a exerce de verdade '
    + '— o .json dele leva a fonte, e exampleSources.test.ts o confere byte a byte.',
  'manifest-property/prefix':
    'o começo dos nomes que a extensão cria. Um exemplo é molde: o prefixo dele seria copiado junto com o código, '
    + 'e duas cópias com o mesmo prefixo colidiriam igual. O create sorteia ou sugere o prefixo de quem escreve, '
    + 'e o AUTHORING o ensina — o exemplo que o mostrasse ensinaria a copiá-lo.',
  'manifest-property/image':
    'o logotipo da extensão. Um exemplo é molde, e um logotipo copiado de molde vira a identidade de outra '
    + 'extensão; quem não declara imagem já ganha o ícone derivado do menu ou da tela que contribui.',
  'manifest-property/homepage':
    'onde ler mais sobre a extensão. Nenhum exemplo tem página própria, e inventar uma URL num molde é pior que '
    + 'omitir o campo: quem copiasse levaria junto um endereço que não existe.',
  'extension-point/http.connection':
    'a credencial de integração que o pacote declara. Ela só tem sentido diante de uma API de verdade: um exemplo '
    + 'que a declarasse acenderia uma pendência em todo escritório que o instalasse, cobrando o segredo de um '
    + 'serviço que não existe. O AUTHORING a ensina ("The credentials you need"), e a validação do pacote a confere.',
};

describe('cobertura dos exemplos de autoria', () => {
  it('a lista é derivada e não está vazia — uma varredura muda faria tudo abaixo passar por nada', () => {
    const all = exampleCoverage(ALL_TRAVELLING_EXAMPLES);
    expect(all.length).toBeGreaterThan(30);
    expect(all.filter((one) => one.gap === 'none').length).toBeGreaterThan(20);
  });

  it('nenhuma lacuna nova: um mecanismo sem exemplo entra aqui ou ganha um exemplo', () => {
    const gaps = exampleCoverageGaps(ALL_TRAVELLING_EXAMPLES).map((one) => `${one.surface}/${one.id}`);
    const novas = gaps.filter((key) => LACUNAS_RECONHECIDAS[key] === undefined);
    expect(novas, `sem exemplo e sem justificativa em LACUNAS_RECONHECIDAS: ${novas.join(', ')}`).toEqual([]);
  });

  /** O inverso: uma justificativa para uma lacuna que já foi fechada descreve um problema que não há. */
  it('e nenhuma justificativa sobrando', () => {
    const gaps = new Set(exampleCoverageGaps(ALL_TRAVELLING_EXAMPLES).map((one) => `${one.surface}/${one.id}`));
    const orfas = Object.keys(LACUNAS_RECONHECIDAS).filter((key) => !gaps.has(key));
    expect(orfas, `lacuna já fechada: ${orfas.join(', ')}`).toEqual([]);
  });

  /**
   * O que está FORA DE ALCANCE não é lacuna, e a diferença é a informação inteira: um autor que procura
   * `data.service` precisa saber que o caminho dele é `startup`, e não concluir que ninguém se lembrou
   * de escrever o exemplo.
   */
  it('o que está fora de alcance diz o caminho que existe no lugar', () => {
    for (const item of exampleCoverage(ALL_TRAVELLING_EXAMPLES)) {
      if (item.gap !== 'unreachable') continue;
      expect(item.note, item.id).toContain('OUT OF REACH');
      expect(item.note.length, item.id).toBeGreaterThan(60);
    }
  });

  /**
   * A ponte com os outros dois lados. `ALL_TRAVELLING_EXAMPLES` é do repositório, `EXAMPLE_SOURCES` é do
   * Console e `EXAMPLE_NOTES` é do SDK: três listas, três pacotes, e este é o único lugar em que as
   * três se olham. Sem isto, a cobertura poderia estar medindo um conjunto que não é o que viaja.
   */
  it('mede exatamente os exemplos que viajam, e todos têm nota', () => {
    const medidos = ALL_TRAVELLING_EXAMPLES.map((one) => one.manifest.id).sort();
    const viajam = Object.keys(EXAMPLE_SOURCES).length;

    expect(medidos.length).toBe(viajam);
    for (const folder of Object.keys(EXAMPLE_SOURCES)) {
      expect(EXAMPLE_NOTES[folder], folder).toBeDefined();
    }
  });

  it('o resumo fecha: cada superfície soma ensinados, lacunas e fora de alcance', () => {
    for (const one of exampleCoverageSummary(ALL_TRAVELLING_EXAMPLES)) {
      expect(one.taught + one.gaps + one.unreachable, one.surface).toBe(one.total);
    }
  });
});
