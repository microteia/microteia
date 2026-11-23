import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import {
  COMMIT_TYPES,
  artifactsOf,
  bumpOf,
  highestBump,
  nextVersion,
  parseCommit,
  parseGitLog,
  planRelease,
  releaseEntry,
  withCliVersion,
  withEntry,
  withPackageVersion,
} from './release.js';
import type { GitCommit } from './release.js';

const commit = (subject: string, paths: string[], body = ''): GitCommit => ({
  hash: subject.slice(0, 7),
  subject,
  body,
  paths,
});

describe('a mensagem do commit', () => {
  it('lê tipo, escopo e assunto', () => {
    expect(parseCommit('fix(access): the column no longer clips (#25)')).toMatchObject({
      type: 'fix',
      scope: 'access',
      breaking: false,
      subject: 'fix(access): the column no longer clips (#25)',
    });
  });

  it('a quebra vem do ! ou do rodapé BREAKING CHANGE', () => {
    expect(parseCommit('feat(sdk)!: drop x')?.breaking).toBe(true);
    const footer = parseCommit('feat(sdk): drop x', 'Body.\n\nBREAKING CHANGE: x is gone.');
    expect(footer?.breaking).toBe(true);
    expect(footer?.breakingNote).toBe('x is gone.');
  });

  it('o que não está no formato, ou usa tipo desconhecido, não é lido', () => {
    expect(parseCommit('Fix the column')).toBeNull();
    expect(parseCommit('merge: planos como dado (#24)')).toBeNull();
    expect(parseCommit('feat:no space')).toBeNull();
  });
});

describe('o salto de versão', () => {
  it('feat é minor, fix e perf são patch, a quebra é major, o resto não lança', () => {
    expect(bumpOf(parseCommit('feat(x): y')!)).toBe('minor');
    expect(bumpOf(parseCommit('fix(x): y')!)).toBe('patch');
    expect(bumpOf(parseCommit('perf(x): y')!)).toBe('patch');
    expect(bumpOf(parseCommit('docs(x)!: y')!)).toBe('major');
    for (const type of ['docs', 'test', 'chore', 'refactor', 'ci', 'build', 'style', 'revert']) {
      expect(bumpOf(parseCommit(`${type}(x): y`)!), type).toBeNull();
    }
  });

  it('vale o maior salto do intervalo', () => {
    expect(highestBump(['patch', null, 'minor', 'patch'])).toBe('minor');
    expect(highestBump([null, null])).toBeNull();
  });

  it('o número seguinte zera o que vem depois do salto', () => {
    expect(nextVersion('9.299.0', 'patch')).toBe('9.299.1');
    expect(nextVersion('9.299.3', 'minor')).toBe('9.300.0');
    expect(nextVersion('9.299.3', 'major')).toBe('10.0.0');
  });
});

/**
 * O artefato sai do caminho, não do escopo: o escopo é escolhido por quem escreve, o caminho não esquece.
 */
describe('de qual artefato é o commit', () => {
  it('cli/ é o Console, o resto que viaja é o kernel, e um commit pode ser dos dois', () => {
    expect([...artifactsOf(['cli/src/vendor/pack.ts'])]).toEqual(['console']);
    expect([...artifactsOf(['src/presentation/x.tsx', 'functions/src/y.ts'])]).toEqual(['kernel']);
    expect(artifactsOf(['cli/src/a.ts', 'src/b.ts']).size).toBe(2);
  });

  it('documento da raiz e configuração do GitHub não são de artefato nenhum', () => {
    expect(artifactsOf(['CLAUDE.md', 'ARCHITECTURE.md', '.github/workflows/ci.yml']).size).toBe(0);
  });

  it('mas o guia que viaja no SDK é do kernel, mesmo sendo .md', () => {
    expect([...artifactsOf(['src/sdk/node/workspace/AUTHORING.md'])]).toEqual(['kernel']);
  });
});

describe('o plano de release', () => {
  const log = [
    commit('feat(cli/release): versions at release time', ['cli/src/vendor/release.ts', 'CLAUDE.md']),
    commit('fix(access): the column no longer clips (#25)', ['src/presentation/pages/x.styles.tsx']),
    commit('docs(architecture): explain it', ['ARCHITECTURE.md']),
    commit('test(access): cover it', ['src/presentation/pages/x.test.ts']),
    commit('Merge branch x', ['src/a.ts']),
  ];

  it('cada artefato junta só os próprios commits que lançam', () => {
    const kernel = planRelease('kernel', '9.299.0', log);
    expect(kernel).toMatchObject({ from: '9.299.0', to: '9.299.1', bump: 'patch' });
    expect(kernel?.commits.map((c) => c.type)).toEqual(['fix']);

    const console = planRelease('console', '2.47.1', log);
    expect(console).toMatchObject({ to: '2.48.0', bump: 'minor' });
  });

  it('sem nada que lance, não há plano', () => {
    expect(planRelease('kernel', '9.299.0', [commit('docs(x): y', ['src/a.md'])])).toBeNull();
  });

  it('a entrada põe a quebra primeiro, depois feat, depois fix', () => {
    const plan = planRelease('kernel', '1.0.0', [
      commit('fix(a): one', ['src/a.ts']),
      commit('feat(b): two', ['src/b.ts']),
      commit('refactor(c): three', ['src/c.ts'], 'BREAKING CHANGE: c moved.'),
    ])!;
    expect(releaseEntry(plan, '2026-11-23')).toBe(
      '#### [2.0.0] — 2026-11-23\n\n'
      + '- refactor(c): three — BREAKING CHANGE: c moved.\n'
      + '- feat(b): two\n'
      + '- fix(a): one\n\n',
    );
  });
});

describe('o que o release escreve', () => {
  it('a entrada nova vai acima da mais recente, e abaixo do cabeçalho e do molde', () => {
    const contents = '# X\n\n<!--\n#### [9.9.9] — YYYY-MM-DD\n-->\n\n#### [1.0.0] — 2026-01-01\n\n- a\n';
    const result = withEntry(contents, '#### [1.1.0] — 2026-02-02\n\n- b\n\n');
    expect(result.indexOf('[9.9.9]')).toBeLessThan(result.indexOf('[1.1.0]'));
    expect(result.indexOf('[1.1.0]')).toBeLessThan(result.indexOf('[1.0.0]'));
  });

  it('troca só a version do produto no package.json', () => {
    const source = '{\n  "name": "microteia",\n  "version": "9.299.0",\n  "dependencies": { "x": { "version": "1.0.0" } }\n}\n';
    expect(withPackageVersion(source, '9.299.1')).toBe(source.replace('9.299.0', '9.299.1'));
  });

  it('troca a constante CLI_VERSION', () => {
    expect(withCliVersion("export const CLI_VERSION = '2.47.1';\n", '2.48.0')).toBe("export const CLI_VERSION = '2.48.0';\n");
  });

  it('lê o git log com os arquivos de cada commit', () => {
    const output = '\x1eabc\x1ffix(a): b\x1fbody\x1f\n\nsrc/a.ts\nsrc/b.ts\n\x1edef\x1fdocs: c\x1f\x1f\n\nREADME.md\n';
    expect(parseGitLog(output)).toEqual([
      { hash: 'abc', subject: 'fix(a): b', body: 'body', paths: ['src/a.ts', 'src/b.ts'] },
      { hash: 'def', subject: 'docs: c', body: '', paths: ['README.md'] },
    ]);
  });
});

/** O CI confere o título do pull request com uma lista própria, e ela não pode divergir desta. */
describe('as duas pontas da lista de tipos', () => {
  it('o workflow do título aceita exatamente os COMMIT_TYPES', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/pr-title.yml'), 'utf8');
    const listed = /\^\(([a-z|]+)\)/.exec(workflow)?.[1].split('|');
    expect(listed).toEqual([...COMMIT_TYPES]);
  });

  it('o pack e o pack-console recusam trabalho ainda sem versão', () => {
    const source = (relative: string): string => readFileSync(join(repoRoot, 'cli/src', relative), 'utf8');
    expect(source('vendor/pack.ts')).toContain("assertReleased(root, 'kernel')");
    expect(source('vendor/packConsole.ts')).toContain("assertReleased(repoRoot, 'console')");
  });
});
