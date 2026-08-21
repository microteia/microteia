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
 * A conferência é sobre o TEXTO, não sobre um objeto: os tsconfigs deste repositório são JSONC, e
 * qualquer `JSON.parse` aqui precisaria de um mini-parser que quebra no primeiro comentário novo — foi
 * o que aconteceu. O que a guarda quer dizer ("a configuração continua dizendo X") um `toContain`
 * expressa melhor, e não tem como falhar por causa de um comentário.
 */
const config = (name: string): string => CONFIGS[`/${name}`];

const sourceFiles = Object.keys(SOURCES).filter((path) => !path.endsWith('.test.ts'));

describe('as fontes de extensão continuam sendo checadas', () => {
  it('o projeto do app EXCLUI o diretório — senão ele tenta resolver @microteia/* de verdade', () => {
    const app = config('tsconfig.app.json');
    const exclude = /"exclude"\s*:\s*\[([^\]]*)\]/.exec(app)?.[1] ?? '';
    expect(exclude).toContain(VIEWS_DIR);
  });

  it('o projeto das fontes de extensão INCLUI o diretório', () => {
    const extsrc = config('tsconfig.extsrc.json');
    const include = /"include"\s*:\s*\[([^\]]*)\]/.exec(extsrc)?.[1] ?? '';
    expect(include).toContain(VIEWS_DIR);
  });

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

  /**
   * O runtime avalia UM módulo por view, com um `require` que só resolve a API curada: um import
   * relativo entre duas fontes de view não tem como ser resolvido, e falharia só ao abrir a tela.
   *
   * O compilador do SDK sabe FUNDIR várias fontes numa só — por caminho (`sourceFile`) ou por texto
   * (`source`) —, e ali o import relativo entre elas é apagado na junção. Mas cada fonte daqui viaja
   * como UM `?raw`, não como lista, e nada as funde: para elas a regra vale como sempre valeu. A
   * primeira view daqui escrita em várias partes tem de afrouxar esta guarda junto, e explicando.
   */
  it.each(sourceFiles)('%s não importa outra fonte de view', (path) => {
    const relative = [...SOURCES[path].matchAll(/from\s+'(\.[^']*)'/g)].map((match) => match[1]);
    expect(relative, 'o runtime não resolve import relativo em fonte de extensão').toEqual([]);
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
