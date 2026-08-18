import { describe, expect, it } from 'vitest';
import { consolePackageJson, consoleReadme } from './packageTemplates.js';

/**
 * O `package.json` é a razão de `pack-console` existir em vez de um `cp -R`: o Console compilado é
 * ESM, e sem `type: module` o Node só o carrega por adivinhação de sintaxe — que existe a partir do
 * 22.7 e falha antes dele com "Cannot use import statement outside a module". Uma pasta montada à mão
 * esquece disso, e o erro parece defeito da ferramenta.
 */
describe('Console empacotado para fora do repositório', () => {
  const parsed = (): Record<string, unknown> =>
    JSON.parse(consolePackageJson('1.2.3')) as Record<string, unknown>;

  it('declara type module — sem isso o Node recusa o compilado', () => {
    expect(parsed().type).toBe('module');
  });

  it('expõe o comando microteia apontando para o entrypoint compilado', () => {
    expect(parsed().bin).toEqual({ microteia: 'lib/index.js' });
  });

  it('exige o Node da versão em que as functions rodam', () => {
    expect(parsed().engines).toEqual({ node: '>=22' });
  });

  it('carrega a versão do Console, não a do produto', () => {
    expect(parsed().version).toBe('1.2.3');
  });

  it('o README diz como rodar a pasta e o que a máquina precisa ter', () => {
    const readme = consoleReadme('1.2.3');
    expect(readme).toContain('node lib/index.js --help');
    expect(readme).toContain('firebase login');
  });

  /**
   * O `npm link` era a recomendação, e exige sudo onde o prefixo global do npm é de root — o caso do
   * Node instalado em `/usr/local`, que é o instalador oficial no macOS. O link para o entrypoint não
   * depende de npm nenhum, e é por isso que o `pack` carimba a permissão de execução.
   */
  it('o README oferece o caminho sem sudo antes do npm link', () => {
    const readme = consoleReadme('1.2.3');
    const link = readme.indexOf('ln -s');
    const npmLink = readme.indexOf('npm link');
    expect(link, 'o link direto tem de estar documentado').toBeGreaterThan(-1);
    expect(link, 'e vir antes do npm link').toBeLessThan(npmLink);
    expect(readme).toContain('no sudo');
  });
});
