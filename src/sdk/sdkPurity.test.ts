import { describe, expect, it } from 'vitest';

/**
 * O SDK sai desta casa compilado, para rodar num terminal — não no browser. Se o fechamento de
 * `src/sdk/index.ts` alcançar React, Firebase, um store ou a apresentação, o pacote publicado deixa
 * de carregar em Node, e o sintoma aparece na máquina do autor, não aqui.
 *
 * A prova é o fechamento REAL de imports, percorrido a partir do barril — não a lista de imports do
 * barril: é o import indireto, três arquivos abaixo, que passa despercebido numa revisão. Lê a fonte
 * como texto (`?raw`), mesma técnica de `kernelPurity.test.ts` e pelo mesmo motivo — a zona do ESLint
 * pode ser afrouxada sem ninguém perceber, e isto falha no `npm test`.
 *
 * `src/sdk/node/` fica FORA: é a ferramenta de linha de comando, que legitimamente usa `node:fs` e
 * `sucrase`. O que não pode vazar é para dentro do barril, que o app também importa.
 */
const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * O `[^;]*?` no meio é o que mantém a busca DENTRO da declaração. Com `[\s\S]*?` ela atravessava o
 * arquivo: um `export interface` no topo casava com o primeiro `from "..."` que aparecesse depois — e
 * `mergeSources.ts`, que não importa nada, foi acusado de depender de `${specifier}`, o trecho de uma
 * mensagem de erro. Um import de verdade nunca tem `;` antes do `from`, nem quando ocupa várias linhas.
 */
const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/g;

const importsOf = (source: string): string[] =>
  [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1]);

/** Resolve um especificador relativo contra as chaves do glob (absolutas a partir da raiz). */
const resolveKey = (fromKey: string, specifier: string): string | null => {
  const segments = fromKey.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.') continue;
    else if (part === '..') segments.pop();
    else segments.push(part);
  }
  const base = segments.join('/');
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (candidate in SOURCES) return candidate;
  }
  return null;
};

interface Closure {
  files: Set<string>;
  externals: Set<string>;
}

const closureOf = (entries: string[]): Closure => {
  const files = new Set<string>();
  const externals = new Set<string>();

  const walk = (key: string): void => {
    if (files.has(key)) return;
    files.add(key);
    for (const specifier of importsOf(SOURCES[key])) {
      if (!specifier.startsWith('.')) {
        externals.add(specifier);
        continue;
      }
      const target = resolveKey(key, specifier);
      if (target !== null) walk(target);
    }
  };

  entries.forEach(walk);
  return { files, externals };
};

const ALLOWED_EXTERNAL = new Set(['expr-eval']);

const ENTRIES = [
  '/src/sdk/index.ts',
  '/src/sdk/validate.ts',
  '/src/sdk/contributions.ts',
  // A camada de modelo de domínio entra como ENTRADA própria, e não só pelo barril: ela lê o
  // catálogo de entidades chamando `resolveEntity` e `aggregationCreatesCycle`, e a tentação de
  // alcançar um store para "saber o que o escritório tem" é exatamente o import que este teste
  // existe para reprovar antes de sair daqui.
  '/src/sdk/domain/index.ts',
];

describe('o fechamento do SDK não sai do domínio', () => {
  const closure = closureOf(ENTRIES);

  it('só alcança src/domain e src/sdk', () => {
    const foreign = [...closure.files].filter(
      (file) => !file.startsWith('/src/domain/') && !file.startsWith('/src/sdk/'),
    ).sort();
    expect(foreign, 'arquivos fora de domain/ e sdk/ no fechamento do SDK').toEqual([]);
  });

  it('nunca alcança src/sdk/node — a ferramenta de terminal não entra no barril', () => {
    const tooling = [...closure.files].filter((file) => file.startsWith('/src/sdk/node/'));
    expect(tooling).toEqual([]);
  });

  it('não importa nenhuma dependência externa além das declaradas no package.json do SDK', () => {
    const unexpected = [...closure.externals].filter((name) => !ALLOWED_EXTERNAL.has(name)).sort();
    expect(unexpected, 'dependências externas não declaradas').toEqual([]);
  });

  /** Guarda que não dispara é pior que guarda nenhuma. */
  it('o detector reconhece uma violação', () => {
    const impure = closureOf(['/src/presentation/shared/i18n/useT.ts']);
    expect(impure.externals.has('react')).toBe(true);
    expect([...impure.files].some((file) => file.startsWith('/src/stores/'))).toBe(true);
  });
});
