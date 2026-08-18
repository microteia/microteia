import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';

/**
 * Os comandos de PUBLICAÇÃO só existem dentro do repositório da Microteia — é dele que saem o
 * frontend construído e as functions compiladas. Mas eles viajam no Console empacotado (o
 * `index.js` importa todos os comandos), então rodar `pack` numa cópia solta é um erro provável.
 *
 * Sem esta guarda o erro era um `ENOENT ... package.json` cru, que não diz o que fazer e parece
 * defeito da ferramenta em vez de comando aplicado no lugar errado.
 */
export const assertInsideRepository = async (command: string): Promise<void> => {
  const manifest = join(repoRoot, 'package.json');

  try {
    await access(manifest);
    const parsed = JSON.parse(await readFile(manifest, 'utf8')) as { name?: string };
    if (parsed.name === 'microteia') return;
  } catch {
    // Cai na mensagem abaixo: ausente e ilegível têm a mesma causa e a mesma saída.
  }

  throw new Error(
    `"microteia ${command}" builds from the Microteia repository, and this copy is not inside one.\n`
    + `Run it from a checkout of the repository (looked for ${manifest}).\n`
    + 'The Console alone installs and updates Microteia; it cannot build a package.',
  );
};
