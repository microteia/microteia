import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializePackage } from '../src/domain/usecases/plugins/packageSerialization';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';
import { kanbanCasesPlugin } from '../src/plugins/marketplace/kanbanCases';
import { processoClonePlugin } from '../src/plugins/marketplace/processoClone';

/**
 * O `.ts` é a fonte; o `.json` de `extension-templates/` é o artefato distribuível, gerado por
 * `npm run build:extensions`. Este teste é a rede contra o erro que já aconteceu: alterar a extensão
 * no código, esquecer de regerar o arquivo e importar num escritório um pacote antigo — que instala
 * uma tela diferente da que está no repositório, sem nenhum aviso.
 */
const TEMPLATES: { file: string; plugin: MarketplacePlugin }[] = [
  { file: 'extension-templates/processo.json', plugin: processoClonePlugin },
  { file: 'extension-templates/kanban-processos.json', plugin: kanbanCasesPlugin },
];

describe('pacotes distribuíveis das extensões de primeira parte', () => {
  it.each(TEMPLATES)('$file reflete a fonte', ({ file, plugin }) => {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    expect(content.trim(), 'desatualizado — rode "npm run build:extensions"')
      .toBe(serializePackage(plugin).trim());
  });
});
