import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializePackage } from '../src/domain/usecases/plugins/packageSerialization';
import { validatePackage } from '../src/domain/usecases/plugins/pluginReferences';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';
import { kanbanCasesPlugin } from '../src/plugins/marketplace/kanbanCases';
import { contratoPlugin } from '../src/plugins/marketplace/contrato';
import { pessoaPlugin } from '../src/plugins/marketplace/pessoa';
import { processoPlugin } from '../src/plugins/marketplace/processo';

/**
 * O `.ts` é a fonte; o `.json` de `extension-templates/` é o artefato distribuível, gerado por
 * `npm run build:extensions`. Este teste é a rede contra o erro que já aconteceu: alterar a extensão
 * no código, esquecer de regerar o arquivo e importar num escritório um pacote antigo — que instala
 * uma tela diferente da que está no repositório, sem nenhum aviso.
 */
const TEMPLATES: { file: string; plugin: MarketplacePlugin }[] = [
  { file: 'extension-templates/pessoa.json', plugin: pessoaPlugin },
  { file: 'extension-templates/contrato.json', plugin: contratoPlugin },
  { file: 'extension-templates/processo.json', plugin: processoPlugin },
  { file: 'extension-templates/kanban-processos.json', plugin: kanbanCasesPlugin },
];

describe('pacotes distribuíveis das extensões de primeira parte', () => {
  it.each(TEMPLATES)('$file reflete a fonte', ({ file, plugin }) => {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    expect(content.trim(), 'desatualizado — rode "npm run build:extensions"')
      .toBe(serializePackage(plugin).trim());
  });
});

/**
 * As extensões de primeira parte precisam passar na MESMA validação do import — é o que o autor vê
 * no dry-run do "Criar Plugin". Processos aponta para `persons`, que saiu do kernel: sem a
 * dependência declarada (com a coleção que ela traz), o pacote deixaria de ser exportável.
 */
describe('integridade referencial das extensões de primeira parte', () => {
  it.each([
    ['Pessoas', pessoaPlugin],
    ['Contratos', contratoPlugin],
    ['Processos', processoPlugin],
    ['Kanban de Processos', kanbanCasesPlugin],
  ])('%s valida sem pendências', (_name, plugin) => {
    expect(validatePackage(plugin)).toEqual([]);
  });
});
