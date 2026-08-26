import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * O carimbo das extensões que a instalação carrega ANTES do login.
 *
 * Existe porque a tela de entrada roda acima do escritório: não há tenant, logo não há como ler o que
 * um escritório instalou — e era esse o vão que deixava o SSO fora de alcance. O que se pode ler antes
 * do login é o que veio carimbado, e quem carimba é quem instala.
 *
 * As recusas aqui são todas do mesmo tipo: um pacote que carrega e não faz nada é PIOR que um erro,
 * porque quem o carimbou acredita que está no ar. Por isso este módulo prefere parar o deploy a
 * escrever um carimbo que decepciona depois.
 */

/** O que o navegador espera encontrar. Só a forma; a validação de conteúdo é do Kernel. */
interface StampedPackage {
  manifest: { id: string; version: string; contributes: Array<{ point?: unknown }> };
  views?: unknown[];
}

/**
 * Este arquivo BLOQUEIA a página: é um `<script>` no `<head>`, antes do bundle. Um pacote gordo aqui
 * custa em toda visita, inclusive na de quem nem vai entrar. O aviso vem antes de doer, e a recusa
 * vem quando já dói para todo mundo.
 */
export const STAMP_WARN_BYTES = 256 * 1024;
export const STAMP_MAX_BYTES = 1024 * 1024;

export const STAMP_FILE = 'microteia-extensions.js';

export interface LoginExtensionsResult {
  /** O conteúdo do arquivo carimbado. Escrito sempre, mesmo vazio — ver `stampLoginExtensions`. */
  contents: string;
  /** `id@version` de cada pacote carimbado, na ordem declarada. */
  stamped: string[];
  /** O que quem instala precisa saber sem que o deploy pare. */
  warnings: string[];
  bytes: number;
}

export const parseExtensionPaths = (declared: string | null): string[] =>
  (declared ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

const asStampedPackage = (parsed: unknown, path: string): StampedPackage => {
  const manifest = (parsed as { manifest?: unknown })?.manifest;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`${path} is not an extension package: it has no "manifest".`);
  }
  const { id, version, contributes } = manifest as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') {
    throw new Error(`${path} has no "manifest.id".`);
  }
  if (typeof version !== 'string' || version === '') {
    throw new Error(`${path} has no "manifest.version".`);
  }
  if (!Array.isArray(contributes)) {
    throw new Error(`${path} has no "manifest.contributes" array.`);
  }
  return parsed as StampedPackage;
};

/**
 * Monta o carimbo. `preLoginPoints` vem do manifesto do PACOTE do kernel instalado, e não de uma lista
 * aqui: o Console é versionado separadamente, e uma cópia dela passaria a descrever o contrato de
 * outra versão em silêncio. Ausente (pacote antigo), a checagem é pulada em vez de inventada.
 */
export const buildLoginExtensions = async (
  root: string,
  declared: string | null,
  preLoginPoints: string[] | undefined,
): Promise<LoginExtensionsResult> => {
  const paths = parseExtensionPaths(declared);
  const packages: StampedPackage[] = [];
  const stamped: string[] = [];
  const warnings: string[] = [];

  for (const path of paths) {
    const absolute = resolve(root, path);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(absolute, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `login.extensions lists ${path}, which does not exist.\n`
          + 'Compile the extension first ("microteia-plugin build" inside extensions/), '
          + 'or remove the path from microteia.yaml.',
          { cause: error },
        );
      }
      throw new Error(`${path} is not valid JSON.`, { cause: error });
    }

    const pkg = asStampedPackage(parsed, path);

    if (preLoginPoints !== undefined) {
      const points = pkg.manifest.contributes
        .map((contribution) => contribution.point)
        .filter((point): point is string => typeof point === 'string');
      const effective = points.filter((point) => preLoginPoints.includes(point));
      if (effective.length === 0) {
        throw new Error(
          `${path} (${pkg.manifest.id}) contributes nothing that works before sign-in, so stamping it `
          + 'would load it with no effect.\n'
          + `  Points that work before sign-in: ${preLoginPoints.join(', ')}.\n`
          + `  This package contributes: ${points.length === 0 ? '(none)' : [...new Set(points)].join(', ')}.\n`
          + '  To USE it inside the organization, install it from the Extensions screen instead.',
        );
      }
    }

    if (Array.isArray(pkg.views) && pkg.views.length > 0) {
      warnings.push(
        `${pkg.manifest.id} ships ${pkg.views.length} view(s): stamped packages load untrusted, `
        + 'so their code does not run before sign-in — only declarations apply',
      );
    }

    const duplicate = packages.find((existing) => existing.manifest.id === pkg.manifest.id);
    if (duplicate !== undefined) {
      throw new Error(
        `login.extensions lists ${pkg.manifest.id} twice. The Kernel would ignore the second one, `
        + 'so the file says something the installation does not do.',
      );
    }

    packages.push(pkg);
    stamped.push(`${pkg.manifest.id}@${pkg.manifest.version}`);
  }

  const contents = `// Generated by "microteia deploy". Do not edit by hand.\n`
    + `window.__MICROTEIA_EXTENSIONS__ = ${JSON.stringify(packages)};\n`;
  const bytes = Buffer.byteLength(contents, 'utf8');

  if (bytes > STAMP_MAX_BYTES) {
    throw new Error(
      `The stamped extensions would be ${Math.round(bytes / 1024)} KiB, over the `
      + `${STAMP_MAX_BYTES / 1024} KiB limit. This file blocks the page on every visit, including `
      + 'visits by people who never sign in.\n'
      + '  Keep before-sign-in packages to what the sign-in screen needs, and install the rest.',
    );
  }
  if (bytes > STAMP_WARN_BYTES) {
    warnings.push(
      `the stamped extensions are ${Math.round(bytes / 1024)} KiB, and this file blocks the page on `
      + 'every visit',
    );
  }

  return { contents, stamped, warnings, bytes };
};

/**
 * Escreve o carimbo SEMPRE, inclusive vazio. Pular a escrita quando a lista está vazia deixaria o
 * carimbo do deploy anterior no ar: tirar um pacote de `login.extensions` não o tiraria da tela.
 */
export const stampPath = (install: string): string => join(install, 'hosting', STAMP_FILE);
