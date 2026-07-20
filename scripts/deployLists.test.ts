import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * As listas de deploy são MANUAIS: os grupos `deploy:*` no package.json usam `--only functions:<nome>`
 * explícito, e `deploy-functions-individually.cjs` tem um array fixo. Uma function nova que não entre
 * nas duas simplesmente não sobe — sem erro, sem aviso. Já aconteceu com `runAction` e com
 * `recomputeAggregatesOnEntityChange`.
 *
 * Este teste é a rede: falha assim que uma function exportada fica fora de alguma lista.
 */

const ROOT = join(__dirname, '..');
const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8');

const exportedFunctions = (): string[] => {
  const source = read('functions/src/index.ts');
  return [...source.matchAll(/export\s*\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(','))
    .map((name) => name.trim())
    .filter((name) => name !== '');
};

const individualDeployList = (): string[] => {
  const source = read('scripts/deploy-functions-individually.cjs');
  const block = source.match(/const ALL_FUNCTIONS = \[([\s\S]*?)\];/);
  if (!block) throw new Error('ALL_FUNCTIONS não encontrado em deploy-functions-individually.cjs');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
};

const groupedDeployFunctions = (): Set<string> => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const names = new Set<string>();

  for (const [name, command] of Object.entries(pkg.scripts)) {
    // `deploy:functions` e `deploy` sobem tudo — não enumeram, então não contam como cobertura.
    if (!name.startsWith('deploy:') || name === 'deploy:functions' || name === 'deploy:functions:individual') continue;
    for (const match of command.matchAll(/functions:([A-Za-z0-9_]+)/g)) names.add(match[1]);
  }

  return names;
};

describe('listas de deploy', () => {
  it('toda function exportada está em algum grupo deploy:* do package.json', () => {
    const grouped = groupedDeployFunctions();
    const missing = exportedFunctions().filter((name) => !grouped.has(name));

    expect(missing, `functions fora dos grupos de deploy: ${missing.join(', ')}`).toEqual([]);
  });

  it('toda function exportada está na lista do deploy individual', () => {
    const listed = new Set(individualDeployList());
    const missing = exportedFunctions().filter((name) => !listed.has(name));

    expect(missing, `functions fora de ALL_FUNCTIONS: ${missing.join(', ')}`).toEqual([]);
  });

  it('a lista do deploy individual não tem nomes que não existem mais', () => {
    const exported = new Set(exportedFunctions());
    const stale = individualDeployList().filter((name) => !exported.has(name));

    expect(stale, `nomes obsoletos em ALL_FUNCTIONS: ${stale.join(', ')}`).toEqual([]);
  });

  it('encontra as functions (guarda contra o parser silenciosamente vazio)', () => {
    expect(exportedFunctions().length).toBeGreaterThan(20);
    expect(individualDeployList().length).toBeGreaterThan(20);
  });
});
