import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Os grupos `deploy:*` do package.json são MANUAIS: cada um passa `--only functions:<nome>` explícito
 * ao `microteia deploy-functions`. Uma function nova fora de todos eles só sobe no `deploy:functions`
 * inteiro — e quem deploya o grupo que mexeu acha que subiu. Já aconteceu com `runAction` e com
 * `recomputeAggregatesOnEntityChange`.
 *
 * Este teste é a rede: falha assim que uma function exportada fica fora de todos os grupos.
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

const groupedDeployFunctions = (): Set<string> => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const names = new Set<string>();

  for (const [name, command] of Object.entries(pkg.scripts)) {
    // `deploy:functions` e `deploy` sobem tudo — não enumeram, então não contam como cobertura.
    if (!name.startsWith('deploy:') || name === 'deploy:functions') continue;
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

  it('os grupos não citam function que não existe mais', () => {
    const exported = new Set(exportedFunctions());
    const stale = [...groupedDeployFunctions()].filter((name) => !exported.has(name));

    expect(stale, `nomes obsoletos nos grupos deploy:*: ${stale.join(', ')}`).toEqual([]);
  });

  it('encontra as functions (guarda contra o parser silenciosamente vazio)', () => {
    expect(exportedFunctions().length).toBeGreaterThan(20);
    expect(groupedDeployFunctions().size).toBeGreaterThan(20);
  });
});
