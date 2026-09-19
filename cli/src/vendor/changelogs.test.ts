import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLI_VERSION, consoleRoot, repoRoot } from '../shared/paths.js';
import { CONSOLE_CHANGELOG, KERNEL_CHANGELOG, changelogEntries, changelogProblems, changelogVersions } from './changelogs.js';

/**
 * Os dois artefatos que o escritório recebe — a plataforma e o Console — têm cada um o seu histórico
 * técnico, em inglês, e cada um viaja DENTRO do artefato que descreve.
 *
 * Este teste existe porque a disciplina sozinha não sustenta um histórico: ele para na primeira release
 * apressada, que é justamente a que alguém vai querer datar depois. O `pack` e o `pack-console` recusam
 * empacotar uma versão sem entrada; aqui a cobrança chega antes, no `npm test`, quando a entrada ainda
 * custa um minuto.
 */
const file = (path: string): string => readFileSync(path, 'utf8');

const kernelChangelog = file(join(repoRoot, KERNEL_CHANGELOG));
const consoleChangelog = file(join(consoleRoot, CONSOLE_CHANGELOG));
const productVersion = (JSON.parse(file(join(repoRoot, 'package.json'))) as { version: string }).version;

const source = (relative: string): string => file(join(repoRoot, 'cli/src', relative));

describe('o histórico técnico de cada pacote', () => {
  it('o do kernel tem a entrada da versão que está em package.json, no topo', () => {
    expect(changelogProblems(KERNEL_CHANGELOG, kernelChangelog, productVersion)).toEqual([]);
  });

  it('o do Console tem a entrada do CLI_VERSION, no topo', () => {
    expect(changelogProblems(CONSOLE_CHANGELOG, consoleChangelog, CLI_VERSION)).toEqual([]);
  });

  /**
   * O formato é o mesmo dos outros históricos do produto — o `VERSIONS.md` da raiz e o de cada extensão
   * que o `create` gera. Duas convenções para a mesma coisa é o começo de nenhuma.
   */
  it('as entradas usam o mesmo cabeçalho dos outros históricos do produto', () => {
    for (const [name, contents] of [
      [KERNEL_CHANGELOG, kernelChangelog],
      [CONSOLE_CHANGELOG, consoleChangelog],
    ] as const) {
      expect(changelogVersions(contents).length, name).toBeGreaterThan(0);
    }
  });

  /** Em inglês, como todo texto que é entregue a um escritório que pode estar em qualquer lugar. */
  it('são escritos em inglês, e dizem que são sobrepostos no unpack', () => {
    for (const [name, contents] of [
      [KERNEL_CHANGELOG, kernelChangelog],
      [CONSOLE_CHANGELOG, consoleChangelog],
    ] as const) {
      expect(contents, name).toContain('microteia unpack');
      expect(contents, name).toMatch(/newest first/i);
    }
  });
});

describe('o que a conferência recusa', () => {
  const entry = (version: string): string => `#### [${version}] — 2026-08-23\n\n- feat(x): y.\n\n`;

  it('a versão que está saindo sem entrada nenhuma', () => {
    expect(changelogProblems('X.md', entry('1.0.0'), '1.1.0')[0]).toContain('has no entry for 1.1.0');
  });

  /** Ter a entrada não basta: uma entrada enterrada no meio do arquivo não é a versão que está saindo. */
  it('a entrada que existe mas não está no topo', () => {
    const contents = `${entry('1.2.0')}${entry('1.1.0')}`;
    expect(changelogProblems('X.md', contents, '1.1.0')[0]).toContain('is on top');
  });

  it('duas entradas para a mesma versão', () => {
    const contents = `${entry('1.1.0')}${entry('1.1.0')}`;
    expect(changelogProblems('X.md', contents, '1.1.0').join('\n')).toContain('lists 1.1.0 twice');
  });

  it('a ordem invertida — o mais recente vem primeiro', () => {
    const contents = `${entry('1.1.0')}${entry('1.2.0')}`;
    expect(changelogProblems('X.md', contents, '1.1.0').join('\n')).toContain('and the newest goes first');
  });

  it('um arquivo sem entrada alguma diz qual cabeçalho falta', () => {
    expect(changelogProblems('X.md', '# X\n', '1.0.0')[0]).toContain('#### [1.0.0]');
  });
});

/**
 * O caminho de cada um dos dois é a decisão inteira, e é o que este bloco guarda.
 *
 * O do kernel viaja no tarball; o do Console, com o binário do Console — que é versionado e distribuído
 * SEPARADAMENTE. Fosse o Console a carregar o histórico do kernel, um Console de duas versões atrás
 * escreveria na instalação o histórico de outro pacote, em silêncio: é o mesmo defeito que tirou os
 * guias de `extensions/` de dentro do `cli/`.
 */
describe('cada histórico viaja no artefato que ele descreve', () => {
  it('o do kernel é empacotado pelo pack e copiado de dentro do pacote', () => {
    expect(source('vendor/pack.ts')).toContain('KERNEL_CHANGELOG');
    expect(source('vendor/changelogs.ts')).toContain('join(install, KERNEL_CHANGELOG)');
  });

  it('o do Console sai do próprio Console, e não do pacote', () => {
    expect(source('vendor/packConsole.ts')).toContain('CONSOLE_CHANGELOG');
    expect(source('vendor/changelogs.ts')).toContain('join(consoleRoot, CONSOLE_CHANGELOG)');
  });

  /** A âncora do Console vale fora do repositório; `repoRoot` não. */
  it('o Console se localiza por uma raiz própria, que sobrevive ao empacotamento', () => {
    expect(source('shared/paths.ts')).toContain("consoleRoot = resolve(here, '..', '..')");
  });

  it('os dois são recusados no empacotamento antes de qualquer build', () => {
    const pack = source('vendor/pack.ts');
    expect(pack.indexOf('readChangelog')).toBeLessThan(pack.indexOf("run('npm', ['run', 'verify']"));
    expect(source('vendor/packConsole.ts')).toContain('readChangelog');
  });

  /** Sobrepostos, pela mesma razão do `MICROTEIA.md`: prometem estar atuais. */
  it('o unpack os reescreve na raiz da instalação, e não dentro de .microteia', () => {
    expect(source('console/unpack.ts')).toContain('refreshChangelogs(root, install)');
    expect(source('vendor/changelogs.ts')).toContain('join(root, name)');
  });

  /**
   * `extensions/` é opcional, pode ter sido criado com `--dir` em qualquer lugar, é escrito pelo SDK, e
   * já tem um `VERSIONS.md` por extensão dentro dele. O histórico do Console ali seria invisível para
   * quem não escreve extensão e ambíguo para quem escreve.
   */
  it('nenhum dos dois mora em extensions/', () => {
    const changelogs = source('vendor/changelogs.ts');
    expect(changelogs).not.toContain('EXTENSIONS_DIR');
    expect(source('console/pluginWorkspace.ts')).not.toContain('CHANGELOG');
  });

  it('uma instalação anterior a esta capacidade avisa, em vez de falhar o upgrade', () => {
    expect(source('console/unpack.ts')).toContain('changelogs.missing');
  });
});

/**
 * O corpo do release publicado é a entrada do histórico, recortada — e não um texto escrito à mão ao
 * lado dela. Dois textos sobre a mesma versão divergem, e o que divergiria é justamente o que fica
 * visível para quem procura o que mudou.
 */
describe('as entradas recortadas para o release', () => {
  const changelog = [
    '<!-- #### [x.y.z] — AAAA-MM-DD -->',
    '',
    '#### [9.8.3] — 2026-08-25',
    '',
    '- feat(cli/publish): the notes cover the interval.',
    '',
    '#### [9.8.2] — 2026-08-24',
    '',
    '- feat(cli/publish): the channel exists.',
    '',
    '#### [9.8.1] — 2026-08-23',
    '',
    '- fix(core.tenant/ai): something else entirely.',
    '',
  ].join('\n');

  it('recorta do cabeçalho até o próximo, e não até o fim do arquivo', () => {
    const notes = changelogEntries(changelog, '9.8.2', '9.8.1');
    expect(notes.body).toContain('#### [9.8.2]');
    expect(notes.body).toContain('the channel exists');
    expect(notes.body).not.toContain('9.8.1');
    expect(notes.versions).toEqual(['9.8.2']);
  });

  it('a última entrada vai até o fim, porque não há próxima', () => {
    expect(changelogEntries(changelog, '9.8.1', '9.8.0').body).toContain('something else entirely');
  });

  /** O molde do topo é comentário HTML, e ele não pode ser lido como a entrada mais recente. */
  it('o molde do topo não é uma entrada', () => {
    expect(changelogEntries(changelog, '9.8.3').body.startsWith('#### [9.8.3]')).toBe(true);
  });

  it('e uma versão que não está no arquivo recusa', () => {
    expect(() => changelogEntries(changelog, '9.9.9')).toThrow(/no entry for 9\.9\.9/);
  });

  /**
   * O defeito que criou este bloco: a 9.8.2 foi empacotada e não subiu, e o release da 9.8.3 — que
   * CONTÉM a 9.8.2 — não citava uma linha dela. Não há release posterior que volte para contá-la, então
   * aquelas alterações desapareciam para quem procura o que mudou.
   */
  it('cobrem toda versão entre a que está saindo e a última publicada', () => {
    const notes = changelogEntries(changelog, '9.8.3', '9.8.1');
    expect(notes.versions).toEqual(['9.8.3', '9.8.2']);
    expect(notes.body).toContain('the notes cover the interval');
    expect(notes.body).toContain('the channel exists');
    expect(notes.body).not.toContain('something else entirely');
  });

  /**
   * A primeira publicação não tem intervalo: o arquivo de histórico começa antes do catálogo, e despejá-lo
   * inteiro no primeiro release não seria descrever o que subiu.
   */
  it('e a primeira publicação recorta só a própria versão', () => {
    expect(changelogEntries(changelog, '9.8.3').versions).toEqual(['9.8.3']);
  });
});
