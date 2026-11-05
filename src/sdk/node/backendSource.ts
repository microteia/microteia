import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { PackagedBackendSource } from '../../domain/schema/plugin/backendSource';
import { backendSourceCanonical, isBackendSourcePath } from '../../domain/schema/plugin/backendSource';

/** O diretório que o build procura ao lado do `plugin.ts` — o mesmo que o Console procura na instalação. */
export const BACKEND_SOURCE_DIR = 'functions';

const walk = (root: string, dir: string, found: Record<string, string>): void => {
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(root, path, found);
      continue;
    }
    // O caminho vai com `/` em qualquer sistema: é ele que o hash cobre, e um pacote construído no
    // Windows não pode ter outro hash que o mesmo pacote construído no macOS.
    const key = relative(root, path).split(sep).join('/');
    if (isBackendSourcePath(key)) found[key] = readFileSync(path, 'utf8');
  }
};

export const hashBackendSource = (files: Record<string, string>): string =>
  createHash('sha256').update(backendSourceCanonical(files), 'utf8').digest('hex');

/**
 * Lê `functions/` ao lado do `plugin.ts` e devolve a fonte como ela viaja. Nulo quando o diretório não
 * existe — o caso de quase toda extensão.
 *
 * O que fica de fora fica em SILÊNCIO, e é deliberado: teste, `node_modules` e arquivo oculto existem no
 * diretório de qualquer autor que trabalha direito, e avisar sobre eles a cada build ensinaria a ignorar
 * os avisos. O que PODE viajar é a mesma regra que a validação do pacote cobra (`isBackendSourcePath`).
 */
export const readBackendSource = (baseDir: string): PackagedBackendSource | null => {
  const dir = join(baseDir, BACKEND_SOURCE_DIR);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const files: Record<string, string> = {};
  walk(dir, dir, files);
  return { files, hash: hashBackendSource(files) };
};

/**
 * O pacote com a fonte das functions acoplada. Uma fonte já presente no pacote (`backendSource` escrito
 * à mão, ou vindo de outro build) é recusa e não precedência — pelo mesmo motivo de `source` e
 * `sourceFile` juntos: as duas poderiam divergir, e o autor nunca saberia qual foi instalada.
 */
export const attachBackendSource = (pkg: MarketplacePlugin, baseDir: string): MarketplacePlugin => {
  const source = readBackendSource(baseDir);
  if (source === null) return pkg;
  if (pkg.backendSource !== undefined) {
    throw new Error(
      `The package declares "backendSource" and there is also a ${BACKEND_SOURCE_DIR}/ folder next to it`
      + ' — keep the folder; the build bundles it.',
    );
  }
  return { ...pkg, backendSource: source };
};
