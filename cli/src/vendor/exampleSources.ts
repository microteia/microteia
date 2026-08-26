import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * As extensões de primeira parte, empacotadas como FONTE — `plugin.ts` e as views em `.tsx` —, uma pasta
 * por extensão.
 *
 * Viajavam como `.json`. Um `.json` de 90 KB não ensina nada: é o artefato, e quem abre não vê como se
 * chega nele. O que ensina é a fonte, e ela já viaja de qualquer forma — o código das views está dentro
 * do `.json`, em string. Passar a mandar o `.ts` não expõe nada novo; expõe de forma legível o que já ia.
 *
 * A única transformação é de IMPORT: neste repositório um plugin importa `../../domain/entities/...` e
 * `../contributionBuilders`; do lado do escritório, tudo isso é `@microteia/sdk`. Todo símbolo usado
 * pelos doze está no barril do SDK — e é por isso que a conferência é possível: `exampleSources.test.ts`
 * COMPILA cada exemplo reescrito e exige que o `.json` saia byte a byte igual ao versionado. Um símbolo
 * que faltasse no barril reprovaria ali, e não no escritório de alguém.
 */

/** Arquivo distribuído → módulo de origem. O nome da pasta do exemplo é o do `.json`, sem extensão. */
export const EXAMPLE_SOURCES: Record<string, string> = {
  'automation-example': 'automation.ts',
  brasil: 'brasil.ts',
  calendar: 'calendar.ts',
  dashboard: 'dashboard.ts',
  'locale-pt-br': 'localePtBr',
  news: 'news.ts',
};

/**
 * Reescreve os imports de um plugin para a forma que o escritório usa.
 *
 * Um especificador relativo que alcance `domain/` ou os construtores de contribuição é, do lado de fora,
 * `@microteia/sdk`. As views passam a ser vizinhas do `plugin.ts` (`./views/X`), porque no exemplo cada
 * extensão tem a sua pasta — aqui elas moram num diretório comum, com um nível a mais.
 */
export const rewriteImports = (source: string): string => source.replace(
  /from '(\.[^']*)'/g,
  (match, specifier: string) => {
    if (
      /(^|\/)contributionBuilders$/.test(specifier)
      || specifier.includes('domain/')
      || specifier.includes('sdk/')
    ) {
      return "from '@microteia/sdk'";
    }
    // `./views/<plugin>/Nome.tsx?raw` -> `./views/Nome.tsx?raw`
    const view = /^\.\/views\/[^/]+\/(.+)$/.exec(specifier);
    return view === null ? match : `from './views/${view[1]}'`;
  },
);

const HEADER = (id: string): string => `// Example: a Microteia first-party extension, as SOURCE.
//
// This is the same code that produces ${id}.json — the artifact the platform installs. Build it with:
//
//     npx microteia-plugin build ${id}/plugin.ts
//
// Two things differ from how you would write the same extension. The imports: inside Microteia they
// reach into the kernel tree, here everything comes from '@microteia/sdk'. And the view sources: these
// travel as TEXT and are merged by 'mergeViewSources', because the platform bundles them; you point at
// the files with 'sourceFile' and the compiler merges them for you. See AUTHORING.md, section 7.

`;

/**
 * Os módulos VIZINHOS que o plugin importa — hoje, os catálogos de mensagem (`./newsMessages`,
 * `./newsMessagesPtBr`). Um exemplo tem de viajar com o que ele importa, ou o `plugin.ts` staged não
 * compila; enumerar os arquivos à mão numa lista aqui seria a mesma dívida que a lista de views era.
 *
 * A busca é transitiva porque um catálogo importa o outro (o de tradução lê o namespace do de origem),
 * e é limitada ao diretório do marketplace: o que alcança `domain/` já virou `@microteia/sdk`.
 */
const siblingModules = async (marketplace: string, entry: string): Promise<Map<string, string>> => {
  const collected = new Map<string, string>();
  const pending = [entry];

  while (pending.length > 0) {
    const name = pending.shift() as string;
    const source = await readFile(join(marketplace, name), 'utf8');
    for (const match of source.matchAll(/from '\.\/([A-Za-z][\w.-]*)'/g)) {
      const file = `${match[1]}.ts`;
      if (collected.has(file)) continue;
      try {
        collected.set(file, rewriteImports(await readFile(join(marketplace, file), 'utf8')));
      } catch {
        continue;
      }
      pending.push(file);
    }
  }

  return collected;
};

const viewFiles = async (viewsDir: string): Promise<string[]> => {
  try {
    return (await readdir(viewsDir)).filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'));
  } catch {
    return [];
  }
};

/**
 * Escreve `<target>/<plugin>/plugin.ts` e `<target>/<plugin>/views/*` para cada exemplo. Devolve os
 * nomes escritos, que é o que o `pack` reporta.
 */
export const stageExamples = async (repo: string, target: string): Promise<string[]> => {
  const marketplace = join(repo, 'src/plugins/marketplace');
  const written: string[] = [];

  for (const [id, origin] of Object.entries(EXAMPLE_SOURCES)) {
    const directory = join(target, id);
    await mkdir(directory, { recursive: true });

    if (origin.endsWith('.ts')) {
      const source = await readFile(join(marketplace, origin), 'utf8');
      await writeFile(join(directory, 'plugin.ts'), HEADER(id) + rewriteImports(source));

      for (const [name, content] of await siblingModules(marketplace, origin)) {
        await writeFile(join(directory, name), content);
      }

      const plugin = origin.replace(/\.ts$/, '');
      const views = join(marketplace, 'views', plugin);
      const files = await viewFiles(views);
      if (files.length > 0) await mkdir(join(directory, 'views'), { recursive: true });
      for (const name of files) {
        await writeFile(join(directory, 'views', name), await readFile(join(views, name), 'utf8'));
      }
    } else {
      // Extensão que é um DIRETÓRIO (o pacote de idioma, com um arquivo por namespace). O `index.ts`
      // vira `plugin.ts`; os demais são vizinhos dele e os imports relativos seguem valendo.
      for (const name of await readdir(join(marketplace, origin))) {
        if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
        const source = rewriteImports(await readFile(join(marketplace, origin, name), 'utf8'));
        const isEntry = name === 'index.ts';
        await writeFile(
          join(directory, isEntry ? 'plugin.ts' : name),
          isEntry ? HEADER(id) + source : source,
        );
      }
    }

    written.push(id);
  }

  return written.sort();
};
