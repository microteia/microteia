import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageFingerprint, serializePackage } from '../src/domain/usecases/plugins/packageSerialization';
import { isVersionGreater } from '../src/domain/usecases/plugins/publicExtension';
import { validatePluginPackage } from '../src/sdk/validate';
import { MARKETPLACE_CATALOG, automationExamplePlugin } from '../src/plugins/marketplace/catalog';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';

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
const EXEMPLOS_QUE_VIAJAM: MarketplacePlugin[] = [automationExamplePlugin];

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
      expect(template.content.trim(), 'desatualizado — rode "npm run build:extensions"')
        .toBe(serializePackage(plugin as MarketplacePlugin).trim());
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
  'com.microteia.locale-pt-br': { version: '1.54.0', fingerprint: '7a708b6f6828' },
  'com.microteia.brasil': { version: '1.1.0', fingerprint: 'bc1dfe565f9e' },
  'com.microteia.dashboard': { version: '1.2.0', fingerprint: '3d89d46273e6' },
  'com.microteia.calendar': { version: '1.3.0', fingerprint: 'ff568d502c6d' },
  'com.microteia.news': { version: '1.4.0', fingerprint: '6a187135a822' },
  'com.microteia.theme-indigo': { version: '1.2.0', fingerprint: 'e3c5b0b5a9d1' },
  'com.microteia.theme-indigo-light': { version: '1.2.0', fingerprint: '213c6d7c1c6a' },
  'com.microteia.theme-claude': { version: '1.2.0', fingerprint: '8db4b38b451f' },
  'com.microteia.theme-teams': { version: '1.2.0', fingerprint: '62e6b4a4221d' },
  'com.microteia.theme-kindle': { version: '1.2.0', fingerprint: '83354c6cfb25' },
  'com.microteia.theme-themis': { version: '1.2.0', fingerprint: '2b899a947ffa' },
  'com.microteia.theme-themis-night': { version: '1.2.0', fingerprint: 'ca3f730391f9' },
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
