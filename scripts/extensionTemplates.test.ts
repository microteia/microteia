import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializePackage } from '../src/domain/usecases/plugins/packageSerialization';
import { validatePackage } from '../src/domain/usecases/plugins/pluginReferences';
import { MARKETPLACE_CATALOG } from '../src/plugins/marketplace/catalog';
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

const catalogById = new Map<string, MarketplacePlugin>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin]),
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
 * As extensões de primeira parte precisam passar na MESMA validação do import — é o que o autor vê no
 * dry-run do "Criar Plugin". Uma que aponte para a coleção de outra (o Calendário é apontado por quem
 * se mostra na agenda) deixaria de ser exportável sem a dependência declarada, com a coleção que ela
 * traz.
 */
describe('integridade referencial das extensões de primeira parte', () => {
  it.each(MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.name, plugin] as const))(
    '%s valida sem pendências',
    (_name, plugin) => {
      expect(validatePackage(plugin)).toEqual([]);
    },
  );
});
