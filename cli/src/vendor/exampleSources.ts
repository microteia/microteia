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
 * por eles está no barril do SDK — e é por isso que a conferência é possível: `exampleSources.test.ts`
 * COMPILA cada exemplo reescrito e exige que o `.json` saia byte a byte igual ao versionado. Um símbolo
 * que faltasse no barril reprovaria ali, e não no escritório de alguém.
 */

/** A pasta, dentro do marketplace, em que mora um exemplo que existe só para ser lido. */
const EXAMPLES_DIR = 'examples';

/**
 * Arquivo distribuído → módulo de origem, relativo a `src/plugins/marketplace/`. O nome da pasta do
 * exemplo é o do `.json`, sem extensão.
 *
 * Há DUAS formas de origem, e a diferença não é de estilo: é de quem o módulo é.
 *
 * - **Um arquivo** (`automation.ts`) — a extensão mora na raiz do marketplace porque ela é, ou já foi,
 *   uma extensão de PRIMEIRA PARTE do catálogo embutido. Os vizinhos que ela importa são descobertos
 *   por `siblingModules`, e as views dela ficam em `views/<módulo>/`.
 * - **Um diretório** (`examples/report-example`) — a extensão existe SÓ para ser lida. Nada dela entra
 *   no `MARKETPLACE_CATALOG`, então ela não tem por que ocupar a raiz do marketplace junto das que
 *   entram: ali as cinco de primeira parte se perderiam no meio de doze moldes. Tudo o que é dela mora
 *   na pasta dela — o `plugin.ts`, os catálogos de mensagem e as `views/`.
 */
export const EXAMPLE_SOURCES: Record<string, string> = {
  'automation-example': 'examples/automation-example',
  agent: 'agent.ts',
  brasil: 'brasil.ts',
  calendar: 'calendar.ts',
  'business-days': 'businessDays.ts',
  dashboard: 'dashboard.ts',
  'locale-pt-br': 'localePtBr',
  news: 'news.ts',
  'report-example': 'examples/report-example',
  'widget-example': 'examples/widget-example',
  'access-example': 'examples/access-example',
  'backend-example': 'examples/backend-example',
  'library-example': 'examples/library-example',
  'consumer-example': 'examples/consumer-example',
  'patch-example': 'examples/patch-example',
  'theme-example': 'examples/theme-example',
  'auth-example': 'examples/auth-example',
  'command-example': 'examples/command-example',
  'settings-example': 'examples/settings-example',
  'record-tab-example': 'examples/record-tab-example',
  'portal-example': 'examples/portal-example',
  'document-example': 'examples/document-example',
};

/**
 * Os exemplos que existem SÓ para ser lidos — os que não estão no catálogo embutido.
 *
 * A pergunta que eles respondem é do `pack`: de quem é o backend que este repositório sobe. Uma
 * extensão de primeira parte que declare `manifest.backend` reivindica uma function que o kernel
 * compila e deploya, e o `pack` confere isso — reivindicar um nome que não existe aborta o
 * empacotamento, e reivindicar um que existe o TIRA da baseline. Um exemplo não é nada disso: o
 * `functions/` dele viaja como fonte para ser lido, e quem o instalar de verdade constrói o próprio.
 * Sem esta distinção, o primeiro exemplo a ensinar Cloud Functions reprovaria toda publicação.
 *
 * É DERIVADA da forma da origem, e não uma segunda lista a manter: morar em `examples/` é
 * exatamente o que significa não estar no catálogo embutido. As cinco de primeira parte moram na raiz
 * do marketplace porque o bundle as carrega, e é por isso que elas continuam sendo cobradas.
 */
export const READING_ONLY_EXAMPLES: ReadonlySet<string> = new Set(
  Object.entries(EXAMPLE_SOURCES)
    .filter(([, origin]) => origin.startsWith(`${EXAMPLES_DIR}/`))
    .map(([id]) => id),
);

/**
 * Os módulos do kernel cuja casa, para quem escreve de fora, é `@microteia/sdk/node` — a entrada de
 * FERRAMENTA do pacote, e não o barril isomórfico.
 *
 * `scriptSource` está aqui porque um `Script` viaja com `sourceTs` E `compiledJs`, e o sandbox nunca
 * transpila: quem empacota precisa produzir o segundo, com o MESMO transpilador que o runtime usa.
 */
const NODE_ONLY_MODULES = ['sdk/node/', 'domain/services/scriptSource'];

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
    // A FERRAMENTA vem antes da superfície, e a ordem é o ponto: estes caminhos também casariam com as
    // regras genéricas abaixo, que os mandariam para o barril isomórfico — onde `transpileScriptSource`
    // NÃO está, de propósito, porque ele arrasta o `sucrase` e `@microteia/sdk` é a superfície que não
    // arrasta nada. Do lado do escritório ele vem de `@microteia/sdk/node`, que é outra entrada do
    // mesmo pacote. O sintoma seria no escritório de quem instalou, não aqui, se o round-trip byte a
    // byte não compilasse cada exemplo reescrito.
    if (NODE_ONLY_MODULES.some((one) => specifier.includes(one))) return "from '@microteia/sdk/node'";
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

/**
 * Os arquivos de uma pasta do exemplo — `views/` ou `functions/` —, e o teste deles COM eles, de
 * propósito. Pasta ausente é lista vazia, nunca erro: nem todo exemplo tem as duas.
 *
 * O `.rules.test.ts` ao lado de um `.rules.ts` é material didático: é onde se vê que a regra de uma
 * view pode ser extraída e exercitada sem montar React nenhum, que é exatamente o que o `AGENTS.md`
 * pede de quem escreve aqui. O `.test.ts` da RAIZ do módulo é outra coisa — aquele é nosso, sobre a
 * nossa extensão — e é por isso que só ele é filtrado, no laço de baixo.
 */
const sourceFilesIn = async (folder: string): Promise<string[]> => {
  try {
    return (await readdir(folder)).filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'));
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
      const files = await sourceFilesIn(views);
      if (files.length > 0) await mkdir(join(directory, 'views'), { recursive: true });
      for (const name of files) {
        await writeFile(join(directory, 'views', name), await readFile(join(views, name), 'utf8'));
      }
    } else {
      // Extensão que é um DIRETÓRIO: o exemplo de leitura, cuja entrada é `plugin.ts`, e o pacote de
      // idioma, cuja entrada é `index.ts` porque ele é um módulo de primeira parte antes de ser um
      // exemplo. A entrada vira `plugin.ts` no destino nos dois casos — é o nome que o autor compila —
      // e os demais `.ts` são vizinhos dela, com os imports relativos seguindo valendo.
      const source = join(marketplace, origin);
      const names = await readdir(source);
      const entry = names.includes('plugin.ts') ? 'plugin.ts' : 'index.ts';

      for (const name of names) {
        if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
        const text = rewriteImports(await readFile(join(source, name), 'utf8'));
        const isEntry = name === entry;
        await writeFile(join(directory, isEntry ? 'plugin.ts' : name), isEntry ? HEADER(id) + text : text);
      }

      // As views, as Cloud Functions e os scripts de um exemplo moram DENTRO dele, e não em
      // `views/<módulo>/`: a pasta é o pacote, exatamente como do lado do escritório. `functions/` e
      // `scripts/` viajam VERBATIM — a primeira já é escrita contra `microteia-functions/office` e
      // `firebase-functions`, que são os nomes que valem lá, e a segunda não importa nada: o script
      // roda no sandbox, contra globais que só existem lá dentro.
      for (const folder of ['views', 'functions', 'scripts']) {
        const from = join(source, folder);
        const files = await sourceFilesIn(from);
        if (files.length === 0) continue;
        await mkdir(join(directory, folder), { recursive: true });
        for (const name of files) {
          await writeFile(join(directory, folder, name), await readFile(join(from, name), 'utf8'));
        }
      }
    }

    written.push(id);
  }

  return written.sort();
};
