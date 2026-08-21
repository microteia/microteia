import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { repoRoot } from '../shared/paths.js';
import { EXAMPLE_SOURCES, rewriteImports, stageExamples } from './exampleSources.js';

/**
 * Os exemplos que viajam no pacote são a FONTE das extensões de primeira parte, com um único ajuste: os
 * imports que aqui alcançam a árvore do kernel passam a vir de `@microteia/sdk`.
 *
 * Este teste é o que torna esse ajuste confiável. Ele compila cada exemplo reescrito com o compilador do
 * SDK e exige o `.json` versionado, BYTE A BYTE. Duas coisas caem juntas se algo estiver errado:
 *
 * - um símbolo que o barril do SDK não exporte reprova aqui, e não no escritório de quem instalou;
 * - a reescrita de import que erre um caminho reprova aqui, e não numa mensagem de módulo não encontrado.
 *
 * De passagem, é a prova de que o SDK é suficiente para escrever as nossas próprias extensões — que é a
 * afirmação inteira do dogfooding, e não dava para verificar de outro jeito.
 */
const require_ = createRequire(import.meta.url);
const COMPILER = join(repoRoot, 'sdk/lib/sdk/node/compile.js');

let staged: string;

beforeAll(async () => {
  staged = await mkdtemp(join(tmpdir(), 'microteia-examples-'));
  await stageExamples(repoRoot, staged);

  // O `@microteia/sdk` que os exemplos importam: um link para o SDK construído deste repositório.
  await mkdir(join(staged, 'node_modules/@microteia'), { recursive: true });
  const pkg = join(staged, 'node_modules/@microteia/sdk');
  await mkdir(pkg, { recursive: true });
  await writeFile(join(pkg, 'package.json'), JSON.stringify({
    name: '@microteia/sdk',
    version: '0.0.0',
    main: join(repoRoot, 'sdk/lib/sdk/index.js'),
  }));
});

afterAll(async () => {
  if (staged !== undefined) await rm(staged, { recursive: true, force: true });
});

const CASES = Object.keys(EXAMPLE_SOURCES).sort();

describe('a reescrita de import dos exemplos', () => {
  it('manda para o SDK o que alcança a árvore do kernel', () => {
    expect(rewriteImports("from '../../domain/entities/MarketplacePlugin'")).toBe("from '@microteia/sdk'");
    expect(rewriteImports("from '../contributionBuilders'")).toBe("from '@microteia/sdk'");
    expect(rewriteImports("from '../../../domain/schema/i18n/messages'")).toBe("from '@microteia/sdk'");
  });

  it('achata o caminho das views, que no exemplo são vizinhas do plugin.ts', () => {
    expect(rewriteImports("from './views/pessoa/startup.tsx?raw'")).toBe("from './views/startup.tsx?raw'");
  });

  it('não toca num import relativo interno da própria extensão', () => {
    expect(rewriteImports("from './coreAdmin'")).toBe("from './coreAdmin'");
  });
});

describe('cada exemplo compila no artefato versionado', () => {
  it('o compilador do SDK está construído — sem ele os casos abaixo não provariam nada', () => {
    expect(existsSync(COMPILER), 'rode "npm run build:sdk"').toBe(true);
  });

  it.each(CASES)('%s/plugin.ts produz %s.json byte a byte', async (id) => {
    const { buildPlugin } = require_(COMPILER) as {
      buildPlugin: (input: { entry: string }) => { json: string; issues: unknown[] };
    };

    const built = buildPlugin({ entry: join(staged, id, 'plugin.ts') });
    const versioned = await readFile(join(repoRoot, 'extension-templates', `${id}.json`), 'utf8');

    expect(built.issues).toEqual([]);
    expect(built.json).toBe(versioned);
  });

  it('cada exemplo tem a sua PASTA, com o plugin.ts dentro', async () => {
    for (const id of CASES) {
      const entries = await readdir(join(staged, id));
      expect(entries, id).toContain('plugin.ts');
    }
  });

  it('o cabeçalho diz como construir o exemplo', async () => {
    const source = await readFile(join(staged, 'news/plugin.ts'), 'utf8');
    expect(source).toContain('npx microteia-plugin build news/plugin.ts');
  });
});
