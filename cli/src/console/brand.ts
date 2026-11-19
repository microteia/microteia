import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import type { YamlSections } from '../shared/yaml.js';

/**
 * A identidade da INSTALAÇÃO — o produto que ela é para quem a usa — e o carimbo dela no hosting.
 *
 * Uma instalação costuma ser um produto de um ramo só, e sem isto toda instalação se chamava Microteia,
 * que é a plataforma que a executa. O carimbo tem três partes, e cada uma existe por um leitor:
 *
 * - `brand.js` — para o bundle, que desenha a tela de entrada e o menu com ela.
 * - as imagens em `hosting/brand/` — com o hash no nome, porque o hosting serve imagem com
 *   `max-age` de um dia: trocar o logo sob o mesmo nome deixaria o antigo no ar até amanhã.
 * - o `index.html` reescrito — para quem NÃO roda o JavaScript: a prévia de link do WhatsApp, o
 *   buscador, e o título da aba antes de o bundle subir.
 *
 * Este módulo não importa nada do Console além de tipos: o `vite.config.ts` do repositório o usa
 * para a pasta `brand/`, e o carimbo de lá tem de ser o mesmo daqui.
 */

export interface BrandDeclaration {
  name: string | null;
  tagline: string | null;
  description: string | null;
  logo: string | null;
  icon: string | null;
  accent: string | null;
}

export const EMPTY_BRAND: BrandDeclaration = {
  name: null,
  tagline: null,
  description: null,
  logo: null,
  icon: null,
  accent: null,
};

export const brandFromSections = (sections: YamlSections): BrandDeclaration => {
  const value = (key: keyof BrandDeclaration): string | null => {
    const raw = sections.get('brand')?.get(key) ?? null;
    return raw === null || raw.trim() === '' ? null : raw.trim();
  };
  return {
    name: value('name'),
    tagline: value('tagline'),
    description: value('description'),
    logo: value('logo'),
    icon: value('icon'),
    accent: value('accent'),
  };
};

export const BRAND_STAMP_FILE = 'brand.js';
export const BRAND_ASSETS_DIR = 'brand';

/** O `index.html` como o pacote o trouxe. Fica FORA de `hosting/` para não ser servido. */
export const PRISTINE_INDEX_FILE = 'index.pristine.html';

/**
 * O logo é baixado em toda visita à tela de entrada, antes de qualquer outra coisa. Um arquivo de
 * vários megabytes ali é quase sempre a exportação errada do designer, não uma escolha.
 */
export const BRAND_IMAGE_MAX_BYTES = 1024 * 1024;

const LOGO_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const ICON_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;

export interface BrandAsset {
  /** Caminho absoluto do arquivo de quem instala. */
  source: string;
  /** Caminho relativo à raiz do hosting: `brand/logo-1a2b3c4d.png`. */
  target: string;
  contentType: string;
}

export interface BrandStamp {
  /** O conteúdo de `brand.js`. Escrito sempre — ver `applyBrandStamp`. */
  contents: string;
  assets: BrandAsset[];
  /** Reescreve o `index.html` ORIGINAL do pacote. Sem identidade, devolve-o intacto. */
  rewriteHtml: (html: string) => string;
  /** Uma linha para a saída do deploy; nulo quando a instalação mantém a identidade da plataforma. */
  summary: string | null;
}

const NO_BRAND_JS = '// No "brand:" declared for this installation: it shows the Microteia identity.\n';

const loadImage = async (
  baseDir: string,
  path: string,
  field: string,
  types: Record<string, string>,
  fileLabel: string,
): Promise<BrandAsset> => {
  const source = resolve(baseDir, path);
  const extension = extname(source).toLowerCase();
  const contentType = types[extension];
  if (contentType === undefined) {
    throw new Error(
      `${fileLabel}: brand.${field} must be one of ${Object.keys(types).join(', ')} — got "${path}".`,
    );
  }
  const bytes = await readFile(source).catch(() => {
    throw new Error(`${fileLabel}: brand.${field} points to "${path}", which does not exist.`);
  });
  if (bytes.length === 0) throw new Error(`${fileLabel}: brand.${field} "${path}" is empty.`);
  if (bytes.length > BRAND_IMAGE_MAX_BYTES) {
    throw new Error(
      `${fileLabel}: brand.${field} "${path}" has ${Math.ceil(bytes.length / 1024)} KB; the limit is `
      + `${BRAND_IMAGE_MAX_BYTES / 1024} KB. It loads on every visit to the sign-in screen — export a smaller one.`,
    );
  }
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  return { source, target: `${BRAND_ASSETS_DIR}/${field}-${digest}${extension}`, contentType };
};

const escapeAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Uma referência `@namespace/chave` só se resolve com o catálogo, dentro do bundle. No HTML ela
 * apareceria crua na prévia do link, e por isso ali ela é tratada como ausente.
 */
const plainText = (value: string | null): string | null =>
  value === null || value.startsWith('@') ? null : value;

const setMeta = (html: string, attribute: 'name' | 'property', key: string, value: string): string =>
  html.replace(
    new RegExp(`(<meta\\s+${attribute}="${key.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'g'),
    (_match, before: string, after: string) => `${before}${escapeAttribute(value)}${after}`,
  );

export const buildBrandStamp = async (
  baseDir: string,
  declaration: BrandDeclaration,
  fileLabel: string,
): Promise<BrandStamp> => {
  if (declaration.name === null) {
    const stray = (Object.keys(declaration) as Array<keyof BrandDeclaration>)
      .filter((key) => key !== 'name' && declaration[key] !== null);
    if (stray.length > 0) {
      throw new Error(
        `${fileLabel}: brand.name is empty, but ${stray.map((key) => `brand.${key}`).join(', ')} `
        + 'is set. Fill in the name, or clear the whole block to keep the Microteia identity.',
      );
    }
    return { contents: NO_BRAND_JS, assets: [], rewriteHtml: (html) => html, summary: null };
  }

  if (declaration.accent !== null && !ACCENT_PATTERN.test(declaration.accent)) {
    throw new Error(`${fileLabel}: brand.accent must be a color like #1f6feb — got "${declaration.accent}".`);
  }

  const logo = declaration.logo === null
    ? null
    : await loadImage(baseDir, declaration.logo, 'logo', LOGO_TYPES, fileLabel);
  const icon = declaration.icon === null
    ? null
    : await loadImage(baseDir, declaration.icon, 'icon', ICON_TYPES, fileLabel);

  const stamped = {
    name: declaration.name,
    tagline: declaration.tagline,
    description: declaration.description,
    logo: logo === null ? null : `/${logo.target}`,
    accent: declaration.accent === null ? null : declaration.accent.toLowerCase(),
  };

  const contents = '// Stamped by "microteia deploy" from the "brand:" block. Do not edit: the next deploy\n'
    + '// rewrites it.\n'
    + `window.__MICROTEIA_BRAND__ = ${JSON.stringify(stamped, null, 2)};\n`;

  const name = plainText(declaration.name);
  const tagline = plainText(declaration.tagline);
  const description = plainText(declaration.description) ?? tagline;
  // O ícone da aba cai no logo: um PNG ou SVG serve aos dois, e a aba com o logo da plataforma ao
  // lado do nome do produto era justamente o que esta identidade veio corrigir.
  const tabIcon = icon ?? logo;

  const rewriteHtml = (html: string): string => {
    let out = html;
    if (name !== null) {
      const title = tagline === null ? name : `${name} — ${tagline}`;
      out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`);
      out = setMeta(out, 'property', 'og:title', title);
      out = setMeta(out, 'name', 'twitter:title', title);
      out = setMeta(out, 'property', 'og:image:alt', name);
      const summary = description ?? name;
      out = setMeta(out, 'name', 'description', summary);
      out = setMeta(out, 'property', 'og:description', summary);
      out = setMeta(out, 'name', 'twitter:description', summary);
    }
    if (logo !== null) {
      out = setMeta(out, 'property', 'og:image', `/${logo.target}`);
      out = setMeta(out, 'name', 'twitter:image', `/${logo.target}`);
    }
    if (tabIcon !== null) {
      out = out.replace(
        /<link\s+rel="icon"[^>]*>/,
        `<link rel="icon" type="${tabIcon.contentType}" href="/${tabIcon.target}" />`,
      );
    }
    return out;
  };

  const details = [
    logo === null ? null : 'logo',
    icon === null ? null : 'icon',
    stamped.accent === null ? null : `accent ${stamped.accent}`,
  ].filter((detail): detail is string => detail !== null);

  return {
    contents,
    assets: [logo, icon].filter((asset): asset is BrandAsset => asset !== null),
    rewriteHtml,
    summary: details.length === 0 ? declaration.name : `${declaration.name} (${details.join(', ')})`,
  };
};

/**
 * Aplica o carimbo a `install/`. O HTML é reescrito a partir do ORIGINAL do pacote, guardado na
 * primeira vez: reescrever o já reescrito deixava no ar o nome de um deploy anterior quando o bloco
 * era esvaziado. O `unpack` troca `install/` inteiro, e com ele o original — que é o que deve
 * acontecer, porque o kernel novo pode trazer outro `index.html`.
 *
 * `brand.js` e `hosting/brand/` são escritos SEMPRE, inclusive vazios, pelo mesmo motivo do carimbo
 * das extensões pré-login: pular a escrita deixaria no ar o que o deploy anterior carimbou.
 */
export const applyBrandStamp = async (install: string, stamp: BrandStamp): Promise<void> => {
  const hosting = join(install, 'hosting');
  const indexPath = join(hosting, 'index.html');
  const pristinePath = join(install, PRISTINE_INDEX_FILE);

  let pristine = await readFile(pristinePath, 'utf8').catch(() => null);
  if (pristine === null) {
    pristine = await readFile(indexPath, 'utf8');
    await writeFile(pristinePath, pristine);
  }
  await writeFile(indexPath, stamp.rewriteHtml(pristine));

  await rm(join(hosting, BRAND_ASSETS_DIR), { recursive: true, force: true });
  for (const asset of stamp.assets) {
    const target = join(hosting, asset.target);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(asset.source, target);
  }
  await writeFile(join(hosting, BRAND_STAMP_FILE), stamp.contents);
};
