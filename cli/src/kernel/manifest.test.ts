import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import {
  compareVersions,
  declaredParametersIn,
  exportedFunctionNames,
  parseKernelVersion,
} from './manifest.js';
import { repoRoot } from '../shared/paths.js';

const read = (relative: string): string => readFileSync(join(repoRoot, relative), 'utf8');

/**
 * O manifesto declara quais Cloud Functions a instalação tem, e o Console deploya uma a uma a partir
 * dessa lista. Se ela divergir do que `functions/src/index.ts` exporta, uma function nova
 * simplesmente não sobe na casa do cliente — o mesmo defeito que `scripts/deployLists.test.ts` já
 * pegou duas vezes do lado de cá, com `runAction` e `recomputeAggregatesOnEntityChange`.
 */
describe('manifesto do kernel', () => {
  it('enxerga as mesmas functions que a lista guardada do deploy individual', () => {
    const fromIndex = new Set(exportedFunctionNames(read('functions/src/index.ts')));

    const block = read('scripts/deploy-functions-individually.cjs')
      .match(/const ALL_FUNCTIONS = \[([\s\S]*?)\];/);
    if (!block) throw new Error('ALL_FUNCTIONS não encontrado');
    const guarded = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

    const missing = guarded.filter((name) => !fromIndex.has(name));
    expect(missing, `functions que o manifesto não veria: ${missing.join(', ')}`).toEqual([]);
    expect(fromIndex.size).toBe(guarded.length);
  });

  it('encontra as functions (guarda contra o parser silenciosamente vazio)', () => {
    expect(exportedFunctionNames(read('functions/src/index.ts')).length).toBeGreaterThan(20);
  });

  it('lê a versão do contrato do kernel', () => {
    const version = parseKernelVersion(read('src/domain/schema/plugin/kernelVersion.ts'));
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('falha em vez de inventar uma versão quando a constante some', () => {
    expect(() => parseKernelVersion('export const OUTRA_COISA = 1;')).toThrow();
  });
});

/**
 * O `firebase-functions` valida os `defineString` GLOBALMENTE: um sem valor e sem default recusa o
 * deploy de TODAS as functions. Um `GOOGLE_GMAIL_TOPIC` ausente derrubou `callAIProxy` — duas coisas
 * que não se parecem. É por isso que a lista é derivada do código e não copiada de um template.
 */
describe('parâmetros do backend', () => {
  const functionSources = (): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          found.push(readFileSync(path, 'utf8'));
        }
      }
    };
    walk(join(repoRoot, 'functions/src'));
    return found;
  };

  const declared = (): { name: string; required: boolean }[] => {
    const found = new Map<string, { name: string; required: boolean }>();
    for (const source of functionSources()) {
      for (const parameter of declaredParametersIn(source)) {
        if (!found.has(parameter.name) || parameter.required) found.set(parameter.name, parameter);
      }
    }
    return [...found.values()];
  };

  it('distingue quem tem default de quem não tem', () => {
    const parsed = declaredParametersIn(
      "defineString('SEM_DEFAULT');\ndefineString('COM_DEFAULT', { default: 'x' });",
    );
    expect(parsed).toEqual([
      { name: 'SEM_DEFAULT', required: true },
      { name: 'COM_DEFAULT', required: false },
    ]);
  });

  it('encontra os parâmetros reais do backend', () => {
    const names = declared().map((parameter) => parameter.name);
    expect(names).toContain('GOOGLE_GMAIL_TOPIC');
    expect(names.length).toBeGreaterThan(0);
  });

  it('o .env.example do repositório cobre todo parâmetro obrigatório', () => {
    const template = readFileSync(join(repoRoot, 'functions/.env.example'), 'utf8');
    const documented = new Set(
      [...template.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]),
    );
    const missing = declared()
      .filter((parameter) => parameter.required && !documented.has(parameter.name))
      .map((parameter) => parameter.name);

    expect(missing, `ausentes em functions/.env.example: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * É esta comparação que decide se um pacote pode ser instalado pelo Console que o cliente tem. Errar
 * o sinal deixaria um Console velho instalar um pacote que ele não sabe montar — e a falha
 * apareceria como um deploy pela metade, não como uma recusa.
 */
describe('comparação de versão do Console', () => {
  it('ordena por major, minor e patch', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
  });

  it('trata componente ausente como zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.9')).toBeGreaterThan(0);
  });
});
