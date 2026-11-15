import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { transform } from 'sucrase';
import { buildPlugin, inlineAuthoredCode, loadModule } from './compile';

/**
 * O compilador que o autor de fora usa é o MESMO que produz os `extension-templates/*.json` deste
 * repositório. Este teste é o que prova isso, e é a razão de não haver dois compiladores.
 *
 * O risco que ele cobre é o de a nossa esteira e a do escritório divergirem: se o loader do SDK lesse
 * um módulo de forma minimamente diferente da que a nossa esteira lê, o `.json` que um autor produz
 * deixaria de ser comparável ao que produzimos — e ninguém notaria até um pacote instalar errado.
 * Comparar BYTE A BYTE contra os artefatos já versionados não deixa margem.
 */
const ROOT = resolve(__dirname, '../../..');
const CATALOG = join(ROOT, 'src/plugins/marketplace/catalog.ts');

/** Arquivo distribuído -> export do catálogo que o origina, como em `scripts/export-extensions.mjs`. */
const TEMPLATES: [string, string][] = [
  ['brasil.json', 'brasilPlugin'],
  ['locale-pt-br.json', 'localePtBrPlugin'],
  ['calendar.json', 'calendarPlugin'],
  ['business-days.json', 'businessDaysPlugin'],
  ['dashboard.json', 'dashboardPlugin'],
  ['news.json', 'newsPlugin'],
];

describe('o compilador do SDK e os artefatos deste repositório', () => {
  it.each(TEMPLATES)('%s sai igual, byte a byte', (file, exportName) => {
    const built = buildPlugin({ entry: CATALOG, exportName });
    const onDisk = readFileSync(join(ROOT, 'extension-templates', file), 'utf8');
    expect(built.json).toBe(onDisk);
  });

  it.each(TEMPLATES)('%s não tem pendência que a instalação recusaria', (_file, exportName) => {
    expect(buildPlugin({ entry: CATALOG, exportName }).issues).toEqual([]);
  });

  /** Um módulo importado por dois arquivos é avaliado UMA vez, senão duas cópias de uma constante
   * deixam de ser iguais por identidade — e um `Set` de chaves passa a ter o dobro de itens. */
  it('avalia cada módulo uma só vez', () => {
    const cache = new Map<string, Record<string, unknown>>();
    const first = loadModule(CATALOG, cache);
    const second = loadModule(CATALOG, cache);
    expect(second).toBe(first);
    expect(cache.size).toBeGreaterThan(10);
  });

  it('recusa um módulo que não exporta pacote nenhum', () => {
    expect(() => buildPlugin({ entry: join(ROOT, 'src/sdk/index.ts') }))
      .toThrow(/exports no extension package/);
  });

  it('exige escolher quando o módulo exporta vários pacotes', () => {
    expect(() => buildPlugin({ entry: CATALOG })).toThrow(/--export/);
  });

  it('recusa um export que não existe, em vez de compilar o pacote errado', () => {
    expect(() => buildPlugin({ entry: CATALOG, exportName: 'naoExiste' }))
      .toThrow(/does not export a package named "naoExiste"/);
  });
});

/**
 * A fonte de uma view cabia num arquivo só, e era o modelo que empurrava o autor a escrever a view, o
 * estado e o estilo juntos — exatamente o contrário do que este repositório exige de si mesmo. A lista
 * de arquivos existe para isso: o pacote instalado continua carregando UM texto por view, porque o
 * runtime avalia um módulo por view, mas a autoria deixa de ser um arquivo único.
 */
describe('a fonte composta de uma view', () => {
  const directories: string[] = [];

  const workspace = (files: Record<string, string>): string => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-merge-'));
    directories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, name)), { recursive: true });
      writeFileSync(join(directory, name), content, 'utf8');
    }
    return directory;
  };

  const pluginTs = (sourceFile: string | string[]): string =>
    `export default {\n`
    + `  manifest: { id: 'com.example.merge' },\n`
    + `  views: [{ key: 'v', title: 't', icon: 'chart', sourceFile: ${JSON.stringify(sourceFile)} }],\n`
    + `  workflows: [],\n`
    + `};\n`;

  const sourceOf = (files: Record<string, string>, sourceFile: string | string[]): string => {
    const directory = workspace({ ...files, 'plugin.ts': pluginTs(sourceFile) });
    const built = buildPlugin({ entry: join(directory, 'plugin.ts') });
    return built.package.views?.[0].source ?? '';
  };

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  const VIEW = `import { useMemo } from 'react';\n`
    + `import { useTally } from './Panel.viewmodel';\n`
    + `import { Wrap } from './Panel.styles';\n\n`
    + `export default function Panel() {\n`
    + `  const total = useTally();\n`
    + `  return <Wrap>{useMemo(() => total, [total])}</Wrap>;\n`
    + `}\n`;

  const VIEWMODEL = `import { useMemo } from 'react';\n\n`
    + `export const useTally = () => useMemo(() => 1, []);\n`;

  const STYLES = `import { styled } from 'styled-components';\n\n`
    + `export const Wrap = styled.div\`padding: 8px;\`;\n`;

  const MVVM = {
    'views/Panel.view.tsx': VIEW,
    'views/Panel.viewmodel.tsx': VIEWMODEL,
    'views/Panel.styles.tsx': STYLES,
  };

  const LIST = ['./views/Panel.view.tsx', './views/Panel.viewmodel.tsx', './views/Panel.styles.tsx'];

  it('vira um módulo só, com os três arquivos dentro', () => {
    const source = sourceOf(MVVM, LIST);
    expect(source).toContain('export default function Panel()');
    expect(source).toContain('export const useTally');
    expect(source).toContain('export const Wrap');
  });

  /** O `require` do runtime só resolve a API curada: um import relativo que sobrevivesse quebraria a tela. */
  it('perde os imports relativos e mantém os da API curada', () => {
    const source = sourceOf(MVVM, LIST);
    expect(source).not.toContain('./Panel.viewmodel');
    expect(source).not.toContain('./Panel.styles');
    expect(source).toContain("from 'react'");
    expect(source).toContain("from 'styled-components'");
  });

  /** Apagar o import sem apagar a LINHA é o que faz o número de linha de cada arquivo sobreviver. */
  it('e não encurta o arquivo ao apagá-los', () => {
    const source = sourceOf(MVVM, LIST);
    const declared = VIEW.split('\n').length + VIEWMODEL.split('\n').length + STYLES.split('\n').length;
    expect(source.split('\n').length).toBeGreaterThanOrEqual(declared);
  });

  it('marca onde cada arquivo começa — é um humano que lê essa fonte antes de confiar nela', () => {
    expect(sourceOf(MVVM, LIST)).toContain('// --- ./views/Panel.viewmodel.tsx ---');
  });

  /** `sucrase` funde imports repetidos do mesmo módulo, e é por isso que a junção pode ser textual. */
  it('compila depois de fundida, com `react` importado nos dois arquivos', () => {
    const source = sourceOf(MVVM, LIST);
    expect(() => transform(source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
    })).not.toThrow();
  });

  it('um caminho só continua colado VERBATIM, byte a byte', () => {
    const source = sourceOf({ 'views/Panel.view.tsx': STYLES }, './views/Panel.view.tsx');
    expect(source).toBe(STYLES);
  });

  it('recusa import relativo para um arquivo fora da lista', () => {
    expect(() => sourceOf(MVVM, LIST.slice(0, 2))).toThrow(/not one of the merged files/);
  });

  it('recusa dois `export default` — o módulo fundido só pode ter um', () => {
    const files = {
      'a.tsx': 'export default function A() { return null; }\n',
      'b.tsx': 'export default function B() { return null; }\n',
    };
    expect(() => sourceOf(files, ['./a.tsx', './b.tsx'])).toThrow(/can only have one/);
  });

  it('recusa uma lista sem `export default` nenhum', () => {
    expect(() => sourceOf({ 'a.tsx': 'export const A = 1;\n' }, ['./a.tsx']))
      .toThrow(/none of the merged sources has a default export/);
  });

  /**
   * A colisão é o preço do escopo único, e cada arquivo passa pelo `tsc` sozinho sem queixa — só a
   * fusão tem como ver que `Wrap` foi declarado duas vezes.
   */
  it('recusa o mesmo nome de topo declarado em dois arquivos', () => {
    const files = {
      'a.tsx': 'export const Wrap = 1;\nexport default function A() { return null; }\n',
      'b.tsx': 'const Wrap = 2;\nexport const other = Wrap;\n',
    };
    expect(() => sourceOf(files, ['./a.tsx', './b.tsx'])).toThrow(/Merged sources share one scope/);
  });

  it('recusa um nome de topo que colide com um import de outro arquivo', () => {
    const files = {
      'a.tsx': "import { Card } from '@microteia/ui';\nexport default function A() { return <Card />; }\n",
      'b.tsx': 'const Card = 1;\nexport const other = Card;\n',
    };
    expect(() => sourceOf(files, ['./a.tsx', './b.tsx'])).toThrow(/"Card" is declared in both/);
  });

  it('recusa o mesmo arquivo listado duas vezes', () => {
    expect(() => sourceOf(MVVM, ['./views/Panel.view.tsx', './views/Panel.view.tsx']))
      .toThrow(/is listed twice/);
  });

  it('recusa uma lista vazia, em vez de gravar uma view sem fonte', () => {
    expect(() => sourceOf(MVVM, [])).toThrow(/the file list is empty/);
  });

  it('recusa a fusão que não compila, sem esperar a tela abrir', () => {
    const files = {
      'a.tsx': 'export default function A() { return null; }\n',
      'b.tsx': 'export const broken = (;\n',
    };
    expect(() => sourceOf(files, ['./a.tsx', './b.tsx'])).toThrow(/does not compile/);
  });

  /** `startupFile` é código pelo mesmo motivo, e por isso funde do mesmo jeito. */
  it('vale igual para o `startup`', () => {
    const directory = workspace({
      'helpers.ts': 'export const greet = () => 1;\n',
      'startup.ts': "import { greet } from './helpers';\n\nexport default function startup() { return greet; }\n",
      'plugin.ts': "export default {\n  manifest: { id: 'com.example.merge' },\n"
        + "  startupFile: ['./startup.ts', './helpers.ts'],\n  workflows: [],\n};\n",
    });
    const built = buildPlugin({ entry: join(directory, 'plugin.ts') });
    expect(built.package.startup).toContain('export const greet');
    expect(built.package.startup).not.toContain("from './helpers'");
  });
});

/**
 * A MESMA fusão, para a fonte que chega como TEXTO — o caminho `?raw`, que é como os plugins deste
 * repositório declaram view. A diferença é uma só: sem arquivo, o import relativo é conferido pelos
 * NOMES que traz, e não pelo caminho a que aponta.
 */
describe('a fonte composta que chega como texto', () => {
  const VIEW = `import { useMemo } from 'react';\n`
    + `import { useTally } from './Panel.viewmodel';\n\n`
    + `export default function Panel() {\n`
    + `  return <span>{useMemo(() => useTally(), [])}</span>;\n`
    + `}\n`;

  const VIEWMODEL = `import { useMemo } from 'react';\n\n`
    + `export const useTally = () => useMemo(() => 1, []);\n`;

  const sourceOf = (source: string | string[]): string => {
    const built = inlineAuthoredCode(
      {
        manifest: { id: 'com.example.raw' },
        views: [{ key: 'v', title: 't', icon: 'chart', source }],
      } as unknown as Parameters<typeof inlineAuthoredCode>[0],
      __dirname,
    );
    return built.views?.[0].source ?? '';
  };

  it('funde a lista e apaga o import entre as partes', () => {
    const source = sourceOf([VIEW, VIEWMODEL]);
    expect(source).toContain('export default function Panel()');
    expect(source).toContain('export const useTally');
    expect(source).not.toContain('./Panel.viewmodel');
  });

  it('uma string só continua passando intacta', () => {
    expect(sourceOf(VIEW)).toBe(VIEW);
  });

  /** É o esquecimento que o `?raw` convida a cometer: importar a view e deixar o viewmodel de fora. */
  it('recusa o import de um nome que nenhuma parte declara', () => {
    expect(() => sourceOf([VIEW])).toThrow(/imports "useTally" from ".\/Panel.viewmodel"/);
  });

  it('recusa dois `export default` e a colisão de nome, como no caminho por arquivo', () => {
    const other = 'export default function Other() { return null; }\n';
    expect(() => sourceOf([VIEW, VIEWMODEL, other])).toThrow(/can only have one/);
    expect(() => sourceOf([VIEW, VIEWMODEL, 'const useTally = 1;\nexport const x = useTally;\n']))
      .toThrow(/Merged sources share one scope/);
  });

  it('recusa uma lista vazia', () => {
    expect(() => sourceOf([])).toThrow(/the source list is empty/);
  });

  /** O `startup` inline é código pelo mesmo motivo, e funde do mesmo jeito. */
  it('vale igual para o `startup` inline', () => {
    const built = inlineAuthoredCode(
      {
        manifest: { id: 'com.example.raw' },
        startup: ["import { greet } from './helpers';\nexport default () => greet();\n", 'export const greet = () => 1;\n'],
      } as unknown as Parameters<typeof inlineAuthoredCode>[0],
      __dirname,
    );
    expect(built.startup).toContain('export const greet');
    expect(built.startup).not.toContain("from './helpers'");
  });
});

/**
 * Um script de sandbox não importa nada — e era por isso que a decisão que pode estar errada não tinha
 * como sair dele para um arquivo puro, com teste ao lado. A lista em `sourceFile` é a mesma comodidade
 * de autoria da view, com o destino diferente: o texto fundido não pode ter `import` nem `export`.
 */
describe('a fonte composta de um script de sandbox', () => {
  const directories: string[] = [];

  const workspace = (files: Record<string, string>): string => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-script-'));
    directories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, name)), { recursive: true });
      writeFileSync(join(directory, name), content, 'utf8');
    }
    return directory;
  };

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  const RULE = '// A pure check: it imports nothing, so a test can call it.\n'
    + 'export interface Totals { expected: number; found: number }\n\n'
    + 'export function reconcile(totals: Totals): boolean {\n'
    + '  return totals.expected === totals.found;\n'
    + '}\n';

  const MAIN = "import { reconcile } from './reconcile';\n"
    + "import type { Totals } from './reconcile';\n\n"
    + 'async function main() {\n'
    + '  const totals: Totals = { expected: Number(input.expected), found: Number(input.found) };\n'
    + '  return { ok: reconcile(totals) };\n'
    + '}\n\n'
    + 'main()\n';

  const FILES = { 'scripts/reconcile.ts': RULE, 'scripts/check.script.ts': MAIN };
  const LIST = ['./scripts/reconcile.ts', './scripts/check.script.ts'];

  const build = (files: Record<string, string>, script: Record<string, unknown>, migration?: Record<string, unknown>) => {
    const pluginTs = `export default {\n`
      + `  manifest: { id: 'com.example.script' },\n  workflows: [],\n`
      + `  scripts: [${JSON.stringify({ templateId: 'check', name: 'n', inputParams: [], outputParams: [], ...script })}],\n`
      + (migration ? `  migrations: [${JSON.stringify(migration)}],\n` : '')
      + `};\n`;
    const directory = workspace({ ...files, 'plugin.ts': pluginTs });
    return buildPlugin({ entry: join(directory, 'plugin.ts') }).package;
  };

  it('funde a lista num texto sem import nem export, e o compilador preenche o `compiledJs`', () => {
    const [script] = build(FILES, { sourceFile: LIST }).scripts ?? [];
    expect(script.sourceTs).toContain('function reconcile(totals: Totals)');
    expect(script.sourceTs).toContain('async function main()');
    expect(script.sourceTs).not.toMatch(/^\s*(import|export)\b/m);
    expect(script.sourceTs).toContain('// --- ./scripts/reconcile.ts ---');
    expect(script.compiledJs).toContain('function reconcile(totals)');
    expect(script.compiledJs).not.toContain('Totals');
  });

  it('o texto fundido RODA, com o auxiliar declarado antes do `main()`', () => {
    const [script] = build(FILES, { sourceFile: LIST }).scripts ?? [];
    const run = new Function('input', script.compiledJs.replace(/main\(\)\s*;?\s*$/, 'return main();')) as (input: unknown) => Promise<unknown>;
    return expect(run({ expected: 3, found: 3 })).resolves.toEqual({ ok: true });
  });

  it('um arquivo só preenche o `compiledJs` do mesmo jeito', () => {
    const single = 'async function main() { return 1; }\nmain()\n';
    const [script] = build({ 'scripts/one.script.ts': single }, { sourceFile: './scripts/one.script.ts' }).scripts ?? [];
    expect(script.sourceTs).toBe(single);
    expect(script.compiledJs).toContain('async function main()');
  });

  it('a forma antiga — `sourceTs` e `compiledJs` à mão — passa intacta', () => {
    const [script] = build({}, { sourceTs: 'main()', compiledJs: 'whatever()' }).scripts ?? [];
    expect(script).toMatchObject({ sourceTs: 'main()', compiledJs: 'whatever()' });
  });

  it('recusa `compiledJs` escrito à mão ao lado de uma fusão', () => {
    expect(() => build(FILES, { sourceFile: LIST, compiledJs: 'x()' })).toThrow(/drop it, the compiler produces it/);
  });

  it('recusa o import de qualquer coisa que não seja um arquivo da lista', () => {
    const files = { ...FILES, 'scripts/check.script.ts': `import { sum } from 'lodash';\n${MAIN}` };
    expect(() => build(files, { sourceFile: LIST })).toThrow(/imports "lodash".*no module\s+resolver/s);
  });

  it('recusa o import relativo de um arquivo que ficou fora da lista', () => {
    expect(() => build(FILES, { sourceFile: ['./scripts/check.script.ts'] })).toThrow(/not one of the merged files/);
  });

  it('recusa um `export default` — script não exporta nada', () => {
    const files = { ...FILES, 'scripts/reconcile.ts': `${RULE}export default reconcile;\n` };
    expect(() => build(files, { sourceFile: LIST })).toThrow(/has a default export/);
  });

  it('recusa o `main()` fora do último arquivo, que rodaria antes das declarações seguintes', () => {
    expect(() => build(FILES, { sourceFile: [...LIST].reverse() })).toThrow(/goes last/);
  });

  it('recusa a mesma `function` declarada em dois arquivos — fora de módulo, a segunda venceria calada', () => {
    const files = { ...FILES, 'scripts/check.script.ts': `${MAIN}function reconcile() { return false; }\n` };
    expect(() => build(files, { sourceFile: LIST })).toThrow(/"reconcile" is declared in both/);
  });

  it('recusa o script de texto único que ainda usa módulo, com a saída indicada', () => {
    expect(() => build({}, { sourceTs: MAIN })).toThrow(/list them in "sourceFile"/);
  });

  it('funde a lista que chega como TEXTO, como no catálogo embutido', () => {
    const [script] = build({}, { sourceTs: [RULE, MAIN] }).scripts ?? [];
    expect(script.sourceTs).toContain('function reconcile');
    expect(script.sourceTs).not.toContain("from './reconcile'");
  });

  it('vale igual para a migração, que viaja só com `sourceTs`', () => {
    const migration = { id: 'fill', version: '1.1.0', name: 'n', sourceFile: LIST };
    const [built] = build({ ...FILES, 'scripts/one.script.ts': 'main()\n' }, { sourceFile: './scripts/one.script.ts' }, migration).migrations ?? [];
    expect(built.sourceTs).toContain('function reconcile');
    expect(built).not.toHaveProperty('sourceFile');
    expect(built).not.toHaveProperty('compiledJs');
  });

  it('recusa no build a migração que a gravação recusaria no escritório', () => {
    const migration = { id: 'fill', version: '1.1.0', name: 'n', sourceTs: "import x from 'y';\nmain()" };
    expect(() => build({ 'scripts/one.script.ts': 'main()\n' }, { sourceFile: './scripts/one.script.ts' }, migration))
      .toThrow(/Migration "fill" uses import/);
  });
});
