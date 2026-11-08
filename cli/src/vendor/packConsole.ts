import { access, chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { flagValue } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION, consoleRoot, repoRoot } from '../shared/paths.js';
import { blank, bullets, heading, info, step, success } from '../shared/ui.js';
import { CONSOLE_CHANGELOG, readChangelog } from './changelogs.js';
import { consolePackageJson, consoleReadme } from './packageTemplates.js';
import { assertInsideRepository } from './repository.js';

/**
 * O Console pronto para rodar em outra pasta — ou em outra máquina — sem o repositório.
 *
 * O que ele monta é pequeno de propósito: o `lib/` compilado, um `package.json` e um README. Não há
 * dependência de npm a instalar porque o Console usa só módulos nativos do Node; o que ele exige são
 * BINÁRIOS (`firebase`, `npm`, `tar`, `gcloud`), e esses são da máquina, não do pacote.
 *
 * O `package.json` é a razão de este comando existir em vez de um `cp -R`: o compilado é ESM, e sem
 * `type: module` o Node só o carrega por adivinhação de sintaxe — disponível a partir do 22.7 e
 * ausente antes dele. Montar a pasta à mão significa esquecer disso e culpar a ferramenta.
 */
export const packConsole = async (args: ParsedArgs): Promise<void> => {
  await assertInsideRepository('pack-console');

  const compiled = join(repoRoot, 'cli', 'lib');
  const outputDir = flagValue(args, 'output')
    ?? join(repoRoot, 'distributions', 'console', CLI_VERSION);

  heading(`Packaging Microteia Console ${CLI_VERSION}`);

  const total = 3;

  step(1, total, 'Checking the compiled Console');
  try {
    await access(join(compiled, 'index.js'));
  } catch {
    throw new Error(
      `${compiled} has no compiled Console. Run "npm run build:cli" first `
      + '(or use "npm run pack:console", which does it).',
    );
  }
  success(`${compiled}/index.js`);

  /**
   * O histórico do Console viaja COM o Console, e não com o pacote do kernel: é o único jeito de ele não
   * poder descrever uma versão que não está ali. A conferência vem antes de montar a pasta, porque uma
   * entrada que falta se escreve em um minuto e nada mais depende dela.
   */
  step(2, total, 'Checking the changelog');
  const changelog = await readChangelog(consoleRoot, CONSOLE_CHANGELOG, CLI_VERSION);
  success(`${CONSOLE_CHANGELOG} covers ${CLI_VERSION}`);

  step(3, total, 'Assembling the folder');
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(compiled, join(outputDir, 'lib'), { recursive: true });
  await writeFile(join(outputDir, 'package.json'), consolePackageJson(CLI_VERSION));
  await writeFile(join(outputDir, 'README.md'), consoleReadme(CLI_VERSION));
  await writeFile(join(outputDir, CONSOLE_CHANGELOG), changelog);
  // A AGPL exige que o texto da licença acompanhe cada cópia distribuída — e esta é a que vai ao npm.
  // O NOTICE carrega os termos da seção 7 (atribuição, exceção para extensões), que viajam junto.
  for (const file of ['LICENSE', 'NOTICE']) {
    await cp(join(repoRoot, file), join(outputDir, file));
  }
  // Executável com o shebang que o entrypoint já tem: é o que permite apontar um link para ele em
  // qualquer diretório do PATH, sem npm e sem sudo. O `tsc` não carimba a permissão, e no repositório
  // ela vem do `npm install` (que a aplica no alvo do `bin`) — o que não existe numa pasta copiada.
  await chmod(join(outputDir, 'lib', 'index.js'), 0o755);
  success(outputDir);

  blank();
  info('Publish it with:');
  bullets(['microteia publish --console-only --dry-run', 'microteia publish --console-only']);
  blank();
  info('Or run this folder as it is, on any machine with Node 22 and the Firebase CLI:');
  bullets([`node ${join(outputDir, 'lib', 'index.js')} --help`]);
  blank();
};
