import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageFingerprint, serializePackage } from '../src/domain/usecases/plugins/packageSerialization';
import { isVersionGreater } from '../src/domain/usecases/plugins/publicExtension';
import { validatePluginPackage } from '../src/sdk/validate';
import { MARKETPLACE_CATALOG } from '../src/plugins/marketplace/catalog';
import { attachBackendSource } from '../src/sdk/node/backendSource';
import { TRAVELLING_EXAMPLES } from '../src/plugins/marketplace/travellingExamples';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';
import { READING_ONLY_EXAMPLES } from '../cli/src/vendor/exampleSources.js';

/**
 * O `.ts` é a fonte; o `.json` de `extension-templates/` é o artefato distribuível, gerado por
 * `npm run build:extensions`. Este teste é a rede contra o erro que já aconteceu: alterar a extensão no
 * código, esquecer de regerar o arquivo e importar num escritório um pacote antigo — que instala uma
 * tela diferente da que está no repositório, sem nenhum aviso.
 *
 * A lista é DESCOBERTA do diretório, e não escrita à mão. Ela já foi escrita à mão, e o custo apareceu
 * quando as extensões de domínio saíram deste repositório: os quatro nomes que estavam aqui viraram
 * imports quebrados, e nada dizia que os cinco restantes seguiam sem conferência. Descobrindo, um
 * template novo entra conferido e um template órfão é NOMEADO.
 */
const TEMPLATES_DIR = 'extension-templates';

/**
 * As extensões que VIAJAM como exemplo de autoria e não são oferecidas no Marketplace. Elas têm
 * `.json` versionado pela mesma razão das outras — `exampleSources.test.ts` compila a fonte reescrita
 * e exige o artefato byte a byte —, mas ficam fora do `MARKETPLACE_CATALOG` de propósito: são molde
 * de leitura, não coisa que o escritório instala.
 */
const EXEMPLOS_QUE_VIAJAM: MarketplacePlugin[] = TRAVELLING_EXAMPLES;

const catalogById = new Map<string, MarketplacePlugin>(
  [...MARKETPLACE_CATALOG, ...EXEMPLOS_QUE_VIAJAM].map((plugin) => [plugin.manifest.id, plugin]),
);

interface Template {
  file: string;
  id: string;
  content: string;
}

const templates = (): Template[] => readdirSync(join(process.cwd(), TEMPLATES_DIR))
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => {
    const content = readFileSync(join(process.cwd(), TEMPLATES_DIR, file), 'utf8');
    const parsed = JSON.parse(content) as { manifest: { id: string } };
    return { file: `${TEMPLATES_DIR}/${file}`, id: parsed.manifest.id, content };
  });

const CASOS = templates();

/**
 * A INVARIANTE que o `pack` usa para saber de quem é o backend.
 *
 * `READING_ONLY_EXAMPLES` é derivada da forma da origem do lado do Console — morar em `examples/` —, e
 * é ela que tira o exemplo da conferência de reivindicação de function e de índice. Aqui, do lado do
 * repositório, a mesma pergunta tem outra resposta: estar fora do `MARKETPLACE_CATALOG`. As duas
 * precisam concordar, e este é o único lugar em que as duas se olham.
 *
 * Sem isto, um exemplo posto na raiz do marketplace por engano passaria a ser cobrado como extensão
 * de primeira parte, e a primeira notícia disso seria o `pack` abortando a publicação — ou, pior, uma
 * function saindo da baseline do kernel porque um MOLDE a reivindicou.
 */
describe('quem é exemplo de leitura, dos dois lados', () => {
  it('a lista derivada do Console é exatamente a que não está no catálogo embutido', () => {
    const noCatalogo = new Set(MARKETPLACE_CATALOG.map((plugin) => plugin.manifest.id));
    const soLeitura = CASOS
      .filter((template) => !noCatalogo.has(template.id))
      .map((template) => template.file.replace(`${TEMPLATES_DIR}/`, '').replace('.json', ''))
      .sort();

    expect([...READING_ONLY_EXAMPLES].sort()).toEqual(soLeitura);
  });
});

describe('pacotes distribuíveis das extensões de primeira parte', () => {
  it('há template para conferir — um diretório vazio faria o resto passar por nada', () => {
    expect(CASOS.length).toBeGreaterThanOrEqual(5);
  });

  /** Um `.json` cuja fonte não está no catálogo é artefato de uma extensão que saiu — e ninguém o gera. */
  it('todo template tem fonte no catálogo embutido', () => {
    const orfaos = CASOS.filter((template) => !catalogById.has(template.id));
    expect(orfaos.map((template) => template.file), 'rode "npm run build:extensions"').toEqual([]);
  });

  it.each(CASOS.map((template) => [template.file, template] as const))(
    '%s reflete a fonte',
    (_file, template) => {
      const plugin = catalogById.get(template.id);
      expect(plugin, `${template.id} não está no catálogo`).toBeDefined();
      // O objeto em memória não tem a fonte das Cloud Functions: quem a acopla é o build, lendo
      // `functions/` ao lado do `plugin.ts` do exemplo. A conferência faz a mesma conta.
      const folder = join(process.cwd(), 'src/plugins/marketplace/examples', template.file.replace(`${TEMPLATES_DIR}/`, '').replace('.json', ''));
      expect(template.content.trim(), 'desatualizado — rode "npm run build:extensions"')
        .toBe(serializePackage(attachBackendSource(plugin as MarketplacePlugin, folder)).trim());
    },
  );
});

/**
 * A VERSÃO CONFERIDA de cada extensão embutida: o par (versão, impressão do conteúdo) de quando o
 * pacote foi olhado pela última vez.
 *
 * Existe pelo mesmo motivo de `PT_BR_MESSAGES_FINGERPRINT`, e depois do mesmo defeito — desta vez no
 * Notícias, que ganhou termos de licença e ficou na `1.1.0`. Um escritório que já tinha a extensão
 * instalada não recebeu nada: o Marketplace só oferece atualização quando a versão sobe, e o pacote
 * novo ficou parado no bundle enquanto a cópia velha continuava no ar, sem um sintoma sequer.
 *
 * Regerar o `.json` NÃO cobre isso: o artefato passa a refletir a fonte, e as duas pontas concordam
 * numa versão que mente. Só a impressão do conteúdo distingue "não mudou" de "mudou e ninguém
 * avisou".
 */
const VERSAO_CONFERIDA: Record<string, { version: string; fingerprint: string }> = {
  'com.microteia.locale-pt-br': { version: '1.193.0', fingerprint: '4243e3df3593' },
  'com.microteia.agent': { version: '1.2.0', fingerprint: 'b94b8d0f7e84' },
  'com.microteia.brasil': { version: '1.2.1', fingerprint: '847c20bd7988' },
  'com.microteia.dashboard': { version: '1.3.0', fingerprint: '3f24844aa47f' },
  'com.microteia.calendar': { version: '1.8.1', fingerprint: 'a347586cc440' },
  'com.microteia.business-days': { version: '1.1.0', fingerprint: '074db7a73bd5' },
  'com.microteia.news': { version: '1.6.0', fingerprint: 'df676dd0917e' },
  'com.microteia.theme-indigo': { version: '1.2.1', fingerprint: '2c65a329fe5d' },
  'com.microteia.theme-indigo-light': { version: '1.2.1', fingerprint: '95e41ae94732' },
  'com.microteia.theme-claude': { version: '1.2.1', fingerprint: '13f01b450c32' },
  'com.microteia.theme-teams': { version: '1.2.1', fingerprint: 'f1423245f76a' },
  'com.microteia.theme-kindle': { version: '1.2.1', fingerprint: 'ac918b9037cc' },
  'com.microteia.theme-themis': { version: '1.2.1', fingerprint: '7da0f299ff34' },
  'com.microteia.theme-themis-night': { version: '1.2.1', fingerprint: 'e28b5be67fc0' },
};

const impressao = (plugin: MarketplacePlugin): string =>
  createHash('sha256').update(packageFingerprint(plugin)).digest('hex').slice(0, 12);

describe('conteúdo alterado exige versão nova', () => {
  it('toda extensão embutida está na tabela — uma nova entra conferida', () => {
    const ausentes = MARKETPLACE_CATALOG
      .map((plugin) => plugin.manifest.id)
      .filter((id) => VERSAO_CONFERIDA[id] === undefined);
    expect(ausentes, 'acrescente a entrada em VERSAO_CONFERIDA').toEqual([]);
  });

  it.each(MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s: se o conteúdo mudou, a versão subiu',
    (id, plugin) => {
      const conferido = VERSAO_CONFERIDA[id];
      const atual = { version: plugin.manifest.version, fingerprint: impressao(plugin) };
      if (atual.fingerprint === conferido.fingerprint) {
        expect(atual.version, 'conteúdo idêntico e versão diferente — o par ficou incoerente')
          .toBe(conferido.version);
        return;
      }
      expect(
        isVersionGreater(atual.version, conferido.version),
        `o pacote mudou e a versão continua ${conferido.version}. Suba manifest.version e registre `
        + `em VERSAO_CONFERIDA: '${id}': { version: '<nova>', fingerprint: '${atual.fingerprint}' }`,
      ).toBe(true);
    },
  );
});

/**
 * As extensões de primeira parte precisam passar na MESMA validação do import — é o que o autor vê no
 * dry-run do "Criar Plugin". Uma que aponte para a coleção de outra (o Calendário é apontado por quem
 * se mostra na agenda) deixaria de ser exportável sem a dependência declarada, com a coleção que ela
 * traz.
 */
/**
 * A conferência passa pela porta ÚNICA (`validatePluginPackage`), e não só pela integridade
 * referencial: é a mesma pergunta que a instalação faz, e qualquer checagem nova acrescentada lá
 * chega aqui sem ninguém lembrar.
 *
 * E vale para os EXEMPLOS também. Enquanto a lista era só o `MARKETPLACE_CATALOG`, o exemplo de
 * automação — escrito para ser lido como referência — viajou com `icon: 'refresh'`, que nunca
 * existiu no catálogo de ícones, e nada nunca o disse: o kernel desenha o marcador genérico para o
 * que não reconhece, e o defeito só aparecia na tela de quem instalou.
 */
describe('validação de pacote das extensões de primeira parte', () => {
  it.each(
    [...MARKETPLACE_CATALOG, ...EXEMPLOS_QUE_VIAJAM].map((plugin) => [plugin.manifest.name, plugin] as const),
  )('%s valida sem pendências', (_name, plugin) => {
    expect(validatePluginPackage(plugin)).toEqual([]);
  });
});
