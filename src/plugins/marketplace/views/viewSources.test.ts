import { describe, expect, it } from 'vitest';

/**
 * As fontes de view e de `startup` viviam dentro de template literals nos arquivos de plugin. Ali elas
 * não passavam pelo `tsc` nem pelo ESLint, não podiam conter crase, e o autor escrevia às cegas
 * justamente o código que mais precisa de ajuda — a migração para arquivo achou oito declarações
 * ERRADAS na API do host (`RecordCardAction` prometia `label` e `icon`, que não existem) e uma chamada
 * morta a `useLookup`.
 *
 * O que este teste guarda é a configuração que tornou isso possível, e que é frágil por natureza: são
 * quatro arquivos de configuração precisando concordar. Se `tsconfig.app.json` deixar de excluir este
 * diretório, o build do app tenta resolver `@microteia/ui` de verdade e quebra; se
 * `tsconfig.extsrc.json` deixar de incluí-lo, a checagem simplesmente para de existir — em silêncio, o
 * que é pior.
 */
const CONFIGS = import.meta.glob('/tsconfig*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SOURCES = import.meta.glob('/src/plugins/marketplace/views/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PLUGINS = import.meta.glob('/src/plugins/marketplace/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const VIEWS_DIR = 'src/plugins/marketplace/views';

/**
 * O outro diretório de fonte de extensão: as views e o `startup` dos exemplos da coletânea, que moram
 * dentro da pasta de cada um. Ele precisa das MESMAS duas linhas de configuração, e por exatamente o
 * mesmo motivo — um exemplo cuja fonte deixasse de ser checada seria o pior lugar possível para uma
 * declaração errada, porque é dele que se copia.
 */
const EXAMPLE_VIEWS_DIR = 'src/plugins/marketplace/examples/*/views';

/**
 * A conferência é sobre o TEXTO, não sobre um objeto: os tsconfigs deste repositório são JSONC, e
 * qualquer `JSON.parse` aqui precisaria de um mini-parser que quebra no primeiro comentário novo — foi
 * o que aconteceu. O que a guarda quer dizer ("a configuração continua dizendo X") um `toContain`
 * expressa melhor, e não tem como falhar por causa de um comentário.
 */
const config = (name: string): string => CONFIGS[`/${name}`];

const sourceFiles = Object.keys(SOURCES).filter((path) => !path.endsWith('.test.ts'));

describe('as fontes de extensão continuam sendo checadas', () => {
  it.each([VIEWS_DIR, EXAMPLE_VIEWS_DIR])(
    'o projeto do app EXCLUI %s — senão ele tenta resolver @microteia/* de verdade',
    (dir) => {
      const app = config('tsconfig.app.json');
      const exclude = /"exclude"\s*:\s*\[([^\]]*)\]/.exec(app)?.[1] ?? '';
      expect(exclude).toContain(dir);
    },
  );

  it.each([VIEWS_DIR, EXAMPLE_VIEWS_DIR])(
    'o projeto das fontes de extensão INCLUI %s',
    (dir) => {
      const extsrc = config('tsconfig.extsrc.json');
      const include = /"include"\s*:\s*\[([^\]]*)\]/.exec(extsrc)?.[1] ?? '';
      expect(include).toContain(dir);
    },
  );

  it('e mapeia os módulos curados para os tipos gerados, senão o import não resolve', () => {
    const extsrc = config('tsconfig.extsrc.json');
    for (const key of ['@microteia/*', 'react', 'styled-components']) {
      const mapping = new RegExp(`"${key.replace('*', '\\*')}"\\s*:\\s*\\[\\s*"([^"]+)"`).exec(extsrc);
      expect(mapping?.[1], key).toContain('microteia-host.d.ts');
    }
    expect(extsrc).toContain('"jsx": "react-jsx"');
  });

  /**
   * `skipLibCheck: false`, e é a única razão de este projeto existir: aqui a API curada NÃO é uma
   * biblioteca de terceiro, é o nosso contrato — e o erro que ela pode ter é justamente o que
   * `skipLibCheck` cala. Um `React.HTMLAttributes` sem namespace importado dentro do bloco de
   * `styled-components` não reprovava nada: o tipo virava `any`, e com ele o `theme` de todo arquivo
   * de estilos que um autor escreve. Ver `extensionTypeDefs.test.ts`, que cobra o efeito.
   */
  it('e CHECA a declaração curada, em vez de confiar nela', () => {
    expect(config('tsconfig.extsrc.json')).toContain('"skipLibCheck": false');
  });

  /** Sem excluir os testes, o `tsc` deste projeto tropeça em `import.meta.glob`, que é do Vite. */
  it('e deixa os testes de fora — eles não são fonte de extensão', () => {
    expect(config('tsconfig.extsrc.json')).toContain('*.test.ts');
  });

  it('há fonte para checar — um diretório vazio faria os casos acima passarem por nada', () => {
    expect(sourceFiles.length).toBeGreaterThanOrEqual(5);
  });
});

/**
 * O editor só acha um projeto que se chame `tsconfig.json` ou que esteja nas `references` dele. Sem
 * as duas linhas abaixo, `tsconfig.extsrc.json` e `tsconfig.extbackend.json` rodavam no `typecheck`
 * e o VSCode abria as mesmas fontes num projeto inferido — sem `paths`, sem JSX —, pintando de
 * vermelho cada import de `@microteia/*` num código que o gate aprovava. Referenciados, eles também
 * passam a rodar no `tsc -b --force`, que é o portão que o CLAUDE.md manda executar.
 */
describe('o editor e o `tsc -b` enxergam os projetos de fonte de extensão', () => {
  it.each(['tsconfig.extsrc.json', 'tsconfig.extbackend.json'])(
    'o tsconfig.json raiz referencia %s',
    (project) => {
      const references = /"references"\s*:\s*\[([\s\S]*?)\]/.exec(config('tsconfig.json'))?.[1] ?? '';
      expect(references).toContain(`"./${project}"`);
    },
  );
});

/**
 * A fonte de BACKEND de um exemplo — as Cloud Functions dele — é checada pelo mesmo princípio e por um
 * projeto separado, porque ela é outra coisa: roda em Node contra `firebase-functions`, não no
 * navegador contra a API curada de view.
 *
 * Ela quase não foi checada por nada. Acrescentar `firebase-functions` à raiz esbarrava num conflito
 * de peer — a raiz tem `firebase-admin ^14` e a série 6 da biblioteca só aceitava até a 13 —, e a saída
 * fácil seria deixar a fonte de fora do portão com uma nota dizendo que o escritório a checa. Seria a
 * mesma dívida que o código em template literal foi: oito declarações erradas na API curada passaram
 * anos assim, e o que as achou foi pôr o arquivo debaixo do `tsc`.
 */
describe('a fonte de backend dos exemplos continua sendo checada', () => {
  const BACKEND_DIR = 'src/plugins/marketplace/examples/*/functions';

  const BACKEND_SOURCES = import.meta.glob('/src/plugins/marketplace/examples/*/functions/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const PACKAGE_JSON = (import.meta.glob('/package.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>)['/package.json'];

  it('o projeto do app EXCLUI o diretório — ele não tem os tipos do Node', () => {
    const exclude = /"exclude"\s*:\s*\[([^\]]*)\]/.exec(config('tsconfig.app.json'))?.[1] ?? '';
    expect(exclude).toContain(BACKEND_DIR);
  });

  it('e o projeto de backend das extensões o INCLUI', () => {
    const include = /"include"\s*:\s*\[([^\]]*)\]/.exec(config('tsconfig.extbackend.json'))?.[1] ?? '';
    expect(include).toContain(BACKEND_DIR);
  });

  /**
   * O nome pelo qual o AUTOR importa a API do host no servidor. Sem este mapeamento o import não
   * resolveria e o projeto reprovaria por não achar o módulo — o que ao menos é barulhento. O risco
   * real é o mapeamento apontar para outro arquivo: aí a fonte é checada contra um contrato que
   * ninguém recebe, e passa aqui para falhar no escritório.
   */
  it('e mapeia `microteia-functions/office` para a declaração GERADA', () => {
    const extbackend = config('tsconfig.extbackend.json');
    const mapping = /"microteia-functions\/office"\s*:\s*\[\s*"([^"]+)"/.exec(extbackend);
    expect(mapping?.[1]).toContain('microteia-office.d.ts');
  });

  /** Mais estrito que o `tsconfig.json` semeado no escritório: o que passa aqui passa lá. */
  it('e é ESTRITO — o molde não pode ser o arquivo menos conferido', () => {
    expect(config('tsconfig.extbackend.json')).toContain('"strict": true');
  });

  /**
   * Um projeto de configuração que ninguém executa é pior que a ausência dele: ele parece cobertura.
   * O `tsconfig.extsrc.json` só vale porque o `typecheck` o roda, e este vale pelo mesmo motivo.
   */
  it('e roda no `npm run typecheck`, senão o projeto existe e ninguém o executa', () => {
    const scripts = (JSON.parse(PACKAGE_JSON) as { scripts: Record<string, string> }).scripts;
    expect(scripts.typecheck).toContain('tsconfig.extbackend.json');
  });

  it('há fonte de backend para checar', () => {
    expect(Object.keys(BACKEND_SOURCES).length).toBeGreaterThanOrEqual(3);
  });

  /**
   * O runtime avalia UM módulo por view, com um `require` que só resolve a API curada: um import
   * relativo entre duas fontes de view não tem como ser resolvido, e falharia só ao abrir a tela.
   *
   * O que o torna legítimo é a FUSÃO. Uma view escrita em várias partes é declarada por
   * `mergeViewSources` (aqui) ou por uma lista de `sourceFile` (do lado do autor), e a fusão apaga o
   * import relativo entre as partes — depois dela os nomes estão no mesmo escopo. Então a regra não é
   * mais "nenhum import relativo": é que ele aponte para uma parte FUNDIDA JUNTO. Um import para fora
   * do conjunto continua sendo o defeito que só aparecia ao abrir a tela.
   *
   * Os conjuntos saem dos arquivos de plugin, e não de uma lista escrita aqui: é o plugin que decide o
   * que se funde com o quê, e uma lista paralela ficaria desatualizada na primeira view nova.
   */
  const MARKETPLACE = '/src/plugins/marketplace';

  const rawBindings = (plugin: string): Map<string, string> => new Map(
    [...plugin.matchAll(/import\s+(\w+)\s+from\s+'\.(\/views\/[^']+)\?raw'/g)]
      .map(([, name, path]) => [name, MARKETPLACE + path]),
  );

  const mergedGroups = (): string[][] => Object.values(PLUGINS).flatMap((plugin) => {
    const bindings = rawBindings(plugin);
    return [...plugin.matchAll(/mergeViewSources\(\{([^}]*)\}/g)].map(([, body]) => (
      [...body.matchAll(/:\s*(\w+),/g)]
        .map(([, name]) => bindings.get(name))
        .filter((path): path is string => path !== undefined)
    ));
  });

  const GROUPS = mergedGroups();

  const groupOf = (path: string): string[] | null => GROUPS.find((group) => group.includes(path)) ?? null;

  /** `'./Calendar.viewmodel'` a partir de quem o importa — a extensão é o que o especificador omite. */
  const resolveSibling = (from: string, specifier: string): string | null => {
    const base = from.slice(0, from.lastIndexOf('/')) + specifier.slice(1);
    return ['', '.ts', '.tsx'].map((extension) => base + extension).find((candidate) => candidate in SOURCES) ?? null;
  };

  it('há view composta para conferir — sem nenhuma, o caso abaixo passaria por nada', () => {
    expect(GROUPS.length).toBeGreaterThanOrEqual(1);
    for (const group of GROUPS) expect(group.length).toBeGreaterThanOrEqual(2);
  });

  it.each(sourceFiles)('%s só importa parte fundida junto com ela', (path) => {
    const relative = [...SOURCES[path].matchAll(/from\s+'(\.[^']*)'/g)].map((match) => match[1]);
    if (relative.length === 0) return;

    const group = groupOf(path);
    expect(group, 'fonte não fundida não pode importar nada relativo — o runtime não resolve').not.toBeNull();
    for (const specifier of relative) {
      expect(resolveSibling(path, specifier), specifier).not.toBeNull();
      expect(group, `${specifier} não é fundido junto`).toContain(resolveSibling(path, specifier));
    }
  });

  /**
   * A FORMA das views compostas de primeira parte. Elas viajam no pacote do SDK como exemplo de autoria,
   * e o `AUTHORING.md` §7 manda ler `examples/` antes de escrever um mecanismo pela primeira vez — então
   * um exemplo que contradiga o texto ensina o contrário dele, e ensina com mais autoridade.
   *
   * A Agenda tinha 784 linhas num arquivo, com a regra de que dia um cartão ocupa dentro de um `useMemo`.
   * Estes casos são o que impede a próxima de voltar a ter.
   */
  describe('a forma das views compostas', () => {
    const partOf = (group: string[], suffix: string): string | undefined =>
      group.find((path) => path.endsWith(suffix));

    it.each(GROUPS.map((group) => [group[0].slice(group[0].lastIndexOf('/') + 1), group] as const))(
      '%s: a view só renderiza, o view model não tem JSX, e a regra não importa nada',
      (_name, group) => {
        const view = partOf(group, '.view.tsx');
        const viewmodel = partOf(group, '.viewmodel.tsx');
        const rules = group.find((path) => path.endsWith('.rules.ts'));

        expect(view, 'toda view composta tem a parte que renderiza').toBeDefined();
        expect(SOURCES[view as string]).not.toMatch(/\buseState\(|\buseEffect\(|\buseMemo\(|\buseCallback\(|\buseRef\(/);

        expect(viewmodel, 'e a parte que guarda o estado').toBeDefined();
        expect(SOURCES[viewmodel as string]).not.toContain('<S.');

        expect(rules, 'e a regra, que é o que um teste alcança').toBeDefined();
        expect(SOURCES[rules as string]).not.toContain('import ');
      },
    );

    /** Cor literal é o defeito que só aparece quando o escritório troca de tema — e aí em toda a tela. */
    it.each(GROUPS.map((group) => [group[0].slice(group[0].lastIndexOf('/') + 1), group] as const))(
      '%s: o estilo não traz cor literal',
      (_name, group) => {
        const styles = partOf(group, '.styles.tsx');
        expect(styles).toBeDefined();
        expect(SOURCES[styles as string]).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
        expect(SOURCES[styles as string]).toContain('theme.colors');
      },
    );

    /** E a regra existe para ser exercitada: sem o teste ao lado, ela é só um arquivo a mais. */
    it.each(GROUPS.map((group) => [group[0].slice(group[0].lastIndexOf('/') + 1), group] as const))(
      '%s: a regra tem teste ao lado dela',
      (_name, group) => {
        const rules = group.find((path) => path.endsWith('.rules.ts')) as string;
        expect(rules.replace(/\.ts$/, '.test.ts') in SOURCES).toBe(true);
      },
    );
  });

  it.each(sourceFiles)('%s só importa a API curada do host', (path) => {
    // `@microteia/i18n` tem DÍGITO no nome, e `[a-z]+` o reprovava — a primeira view a importar o
    // tradutor descobriu isso. O que a regra guarda é a lista curada de módulos, não o alfabeto.
    const allowed = /^(react(\/.*)?|styled-components|@microteia\/[a-z][a-z0-9]*)$/;
    const bare = [...SOURCES[path].matchAll(/from\s+'([^'.][^']*)'/g)].map((match) => match[1]);
    for (const specifier of bare) {
      expect(specifier, `${specifier} não está na API curada`).toMatch(allowed);
    }
  });

  /**
   * O `?raw` é o que faz a fonte viajar como DADO e ao mesmo tempo morar num arquivo checado. Um
   * plugin que voltasse a declarar a fonte num template literal sairia da checagem sem quebrar nada.
   *
   * A lista de exceções está VAZIA, e é a primeira vez. As três que sobravam — `prazo`, `processo` e `push` —
   * tinham fonte COMPOSTA (blocos de helpers e de estilo de cartão interpolados em vários widgets), e
   * saíram deste repositório junto com as extensões de domínio a que pertenciam.
   *
   * A lista fica aqui, vazia, em vez de o caso virar um `toEqual([])` solto: ela é o registro da
   * exceção, e a próxima fonte composta que aparecer terá de ser escrita nela por alguém que explique
   * o motivo. A saída que era só uma intenção quando isto foi escrito — o compilador EMPACOTAR a view a
   * partir de vários arquivos — hoje existe: é a lista de `sourceFile`.
   */
  const COMPOSED: string[] = [];

  it('nenhum plugin declara view em template literal', () => {
    const offenders = Object.entries(PLUGINS)
      .filter(([, source]) => /const [A-Z_]*SOURCE = `\n\s*import /.test(source))
      .map(([path]) => path)
      .sort();
    expect(offenders, 'declare a fonte num arquivo e importe com "?raw"').toEqual(COMPOSED);
  });
});
