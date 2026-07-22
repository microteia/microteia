import { describe, it, expect } from 'vitest';

const SOURCES = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

const FORBIDDEN: { label: string; matches: (specifier: string) => boolean }[] = [
  { label: 'plugins', matches: (s) => s.includes('plugins/') },
  { label: 'presentation', matches: (s) => s.includes('presentation/') },
  { label: 'data', matches: (s) => s.includes('/data/') || s.startsWith('../data/') },
  { label: 'stores', matches: (s) => s.includes('stores/') },
  { label: 'infrastructure', matches: (s) => s.includes('infrastructure/') },
  { label: 'firebase', matches: (s) => s === 'firebase' || s.startsWith('firebase/') || s.startsWith('firebase-admin') },
  { label: 'react', matches: (s) => s === 'react' || s.startsWith('react/') || s === 'react-dom' },
  { label: 'styled-components', matches: (s) => s === 'styled-components' },
];

const kernelFiles = Object.keys(SOURCES).filter((path) => !path.endsWith('.test.ts')).sort();

const importsOf = (path: string): string[] =>
  Array.from(SOURCES[path].matchAll(IMPORT_PATTERN)).map((match) => match[1]);

/**
 * Princípio nº 1 — o Kernel nunca conhece plugins. A zona `no-restricted-imports` do ESLint já
 * reprova a violação, mas ela vive num arquivo de configuração que pode ser afrouxado sem que
 * ninguém perceba. Este teste é a segunda tranca, e falha no `npm test`.
 */
describe('pureza do Kernel', () => {
  it('encontra os arquivos do Kernel', () => {
    expect(kernelFiles.length).toBeGreaterThan(0);
    expect(kernelFiles).toContain('./PluginHost.ts');
  });

  it.each(kernelFiles)('%s não importa camada proibida', (path) => {
    const offenders = importsOf(path).flatMap((specifier) =>
      FORBIDDEN.filter((rule) => rule.matches(specifier)).map((rule) => `${specifier} (${rule.label})`),
    );
    expect(offenders).toEqual([]);
  });

  it.each(kernelFiles)('%s só depende de contratos ou de outro arquivo do Kernel', (path) => {
    const external = importsOf(path).filter(
      (specifier) => !specifier.startsWith('../domain/schema/plugin/') && !specifier.startsWith('./'),
    );
    expect(external).toEqual([]);
  });

  it('o detector reconheceria uma violação real', () => {
    const specifiers = Array.from(
      "import { doc } from 'firebase/firestore';".matchAll(IMPORT_PATTERN),
    ).map((match) => match[1]);

    expect(specifiers).toEqual(['firebase/firestore']);
    expect(FORBIDDEN.some((rule) => rule.matches('firebase/firestore'))).toBe(true);
    expect(FORBIDDEN.some((rule) => rule.matches('../presentation/pages/pageRegistry'))).toBe(true);
    expect(FORBIDDEN.some((rule) => rule.matches('../plugins/core.ui/manifest'))).toBe(true);
    expect(FORBIDDEN.some((rule) => rule.matches('../stores/useTenant'))).toBe(true);
  });
});
