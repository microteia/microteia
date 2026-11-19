import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { parseStampedBrand } from '../../../src/domain/schema/brand';
import { parseYamlSections } from '../shared/yaml.js';
import {
  BRAND_IMAGE_MAX_BYTES,
  EMPTY_BRAND,
  PRISTINE_INDEX_FILE,
  applyBrandStamp,
  brandFromSections,
  buildBrandStamp,
  carriesBrandStamp,
} from './brand.js';
import type { BrandDeclaration } from './brand.js';

const repoRoot = join(__dirname, '../../..');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

const workspace = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'microteia-brand-'));
  await mkdir(join(root, 'brand'));
  await writeFile(join(root, 'brand', 'logo.png'), PNG);
  await writeFile(join(root, 'brand', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return root;
};

const declared = (overrides: Partial<BrandDeclaration>): BrandDeclaration => ({
  ...EMPTY_BRAND,
  name: 'Acme Legal',
  ...overrides,
});

/** O que o navegador faria com o arquivo: executá-lo e ler o global. */
const evaluate = (contents: string): unknown => {
  const global: Record<string, unknown> = {};
  runInNewContext(contents, global);
  return global.__MICROTEIA_BRAND__;
};

interface ShownNotification {
  title: string;
  options: { icon?: string; badge?: string };
}

/**
 * Roda o `notification-sw.js` REAL como o navegador: o próprio contexto é o `self`, e o
 * `importScripts('/brand.js')` executa o carimbo ali dentro. Devolve o que um push mostraria.
 */
const notificationFrom = async (brandJs: string | null): Promise<ShownNotification> => {
  const handlers = new Map<string, (event: unknown) => void>();
  const shown: ShownNotification[] = [];
  const context = createContext({
    importScripts: (path: string) => {
      expect(path).toBe('/brand.js');
      if (brandJs === null) throw new Error('404');
      runInContext(brandJs, context);
    },
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    registration: {
      showNotification: (title: string, options: ShownNotification['options']) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
  });
  runInContext('var self = globalThis;', context);
  runInContext(await readFile(join(repoRoot, 'public', 'notification-sw.js'), 'utf8'), context);
  handlers.get('push')?.({
    data: { json: () => ({ title: 'Deadline today' }) },
    waitUntil: () => undefined,
  });
  expect(shown).toHaveLength(1);
  return shown[0];
};

describe('identidade da instalação', () => {
  it('lê o bloco brand: com o mesmo leitor do microteia.yaml', () => {
    const sections = parseYamlSections(
      'brand:\n  name: "Acme: Legal"\n  tagline:\n  accent: "#1F6FEB"\n  logo: brand/logo.png\n',
      'brand/brand.yaml',
    );
    expect(brandFromSections(sections)).toEqual({
      ...EMPTY_BRAND,
      name: 'Acme: Legal',
      accent: '#1F6FEB',
      logo: 'brand/logo.png',
    });
    expect(brandFromSections(new Map())).toEqual(EMPTY_BRAND);
  });

  it('sem nome, mantém a identidade da plataforma e não define o global', async () => {
    const stamp = await buildBrandStamp('/nowhere', EMPTY_BRAND, 'microteia.yaml');
    expect(stamp.summary).toBeNull();
    expect(stamp.assets).toEqual([]);
    expect(evaluate(stamp.contents)).toBeUndefined();
    expect(stamp.rewriteHtml('<title>x</title>')).toBe('<title>x</title>');
  });

  it('recusa o bloco preenchido pela metade em vez de ignorá-lo calado', async () => {
    await expect(buildBrandStamp('/nowhere', { ...EMPTY_BRAND, logo: 'logo.png' }, 'microteia.yaml'))
      .rejects.toThrow(/brand\.name is empty, but brand\.logo is set/);
  });

  it('recusa cor, extensão, arquivo ausente e imagem grande demais', async () => {
    const root = await workspace();
    await expect(buildBrandStamp(root, declared({ accent: 'orange' }), 'microteia.yaml'))
      .rejects.toThrow(/brand\.accent/);
    await expect(buildBrandStamp(root, declared({ logo: 'brand/logo.gif' }), 'microteia.yaml'))
      .rejects.toThrow(/brand\.logo must be one of/);
    await expect(buildBrandStamp(root, declared({ logo: 'brand/missing.png' }), 'microteia.yaml'))
      .rejects.toThrow(/does not exist/);
    await expect(buildBrandStamp(root, declared({ icon: 'brand/logo.webp' }), 'microteia.yaml'))
      .rejects.toThrow(/brand\.icon must be one of/);
    await writeFile(join(root, 'brand', 'huge.png'), Buffer.alloc(BRAND_IMAGE_MAX_BYTES + 1));
    await expect(buildBrandStamp(root, declared({ logo: 'brand/huge.png' }), 'microteia.yaml'))
      .rejects.toThrow(/the limit is/);
  });

  it('carimba o que o leitor do KERNEL entende, com a imagem no caminho de hash', async () => {
    const root = await workspace();
    const stamp = await buildBrandStamp(root, declared({
      tagline: 'Legal work, simplified',
      logo: 'brand/logo.png',
      accent: '#1F6FEB',
    }), 'microteia.yaml');

    const parsed = parseStampedBrand(evaluate(stamp.contents));
    expect(parsed).toEqual({
      name: 'Acme Legal',
      tagline: 'Legal work, simplified',
      description: null,
      logo: expect.stringMatching(/^\/brand\/logo-[0-9a-f]{8}\.png$/),
      accent: '#1f6feb',
    });
    expect(evaluate(stamp.contents)).toMatchObject({ appIcon: parsed?.logo });
    expect(stamp.assets.map((asset) => `/${asset.target}`)).toEqual([parsed?.logo]);
    expect(stamp.summary).toBe('Acme Legal (logo, accent #1f6feb)');
  });

  it('reescreve o título, a descrição, as prévias de link e os ícones do index.html do kernel', async () => {
    const root = await workspace();
    const stamp = await buildBrandStamp(root, declared({
      name: 'Acme "Legal"',
      tagline: 'Legal work, simplified',
      logo: 'brand/logo.png',
      icon: 'brand/icon.svg',
    }), 'microteia.yaml', 'https://acme-legal.web.app');

    const html = stamp.rewriteHtml(await readFile(join(repoRoot, 'index.html'), 'utf8'));

    expect(html).not.toMatch(/Microteia/);
    expect(html).not.toMatch(/apple-touch-icon\.png|favicon\.ico/);
    expect(html).toContain('<title>Acme &quot;Legal&quot; — Legal work, simplified</title>');
    expect(html).toContain('<meta property="og:title" content="Acme &quot;Legal&quot; — Legal work, simplified" />');
    expect(html).toContain('<meta name="twitter:description" content="Legal work, simplified" />');
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/acme-legal\.web\.app\/brand\/logo-[0-9a-f]{8}\.png" \/>/);
    expect(html).toMatch(/<meta name="twitter:image" content="https:\/\/acme-legal\.web\.app\/brand\/logo-[0-9a-f]{8}\.png" \/>/);
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/brand\/icon-[0-9a-f]{8}\.svg" \/>/);
    // O ícone é SVG, que o iOS não aceita: o atalho da tela de início fica com o logo PNG.
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/brand\/logo-[0-9a-f]{8}\.png" \/>/);
  });

  it('o domínio próprio vence o endereço do projeto, e só a origem é aceita', async () => {
    const root = await workspace();
    const stamp = await buildBrandStamp(
      root,
      declared({ logo: 'brand/logo.png', url: 'https://legal.acme.example/' }),
      'microteia.yaml',
      'https://acme-legal.web.app',
    );
    const html = stamp.rewriteHtml(await readFile(join(repoRoot, 'index.html'), 'utf8'));
    expect(html).toMatch(/content="https:\/\/legal\.acme\.example\/brand\/logo-[0-9a-f]{8}\.png"/);
    expect(stamp.summary).toBe('Acme Legal (logo, at https://legal.acme.example)');

    for (const url of ['legal.acme.example', 'ftp://legal.acme.example', 'https://acme.example/app']) {
      await expect(buildBrandStamp(root, declared({ url }), 'microteia.yaml')).rejects.toThrow(/brand\.url/);
    }
  });

  it('sem identidade própria, a prévia ainda ganha o endereço completo do logo da plataforma', async () => {
    const stamp = await buildBrandStamp('/nowhere', EMPTY_BRAND, 'microteia.yaml', 'https://acme-legal.web.app');
    const html = stamp.rewriteHtml(await readFile(join(repoRoot, 'index.html'), 'utf8'));
    expect(html).toContain('<meta property="og:image" content="https://acme-legal.web.app/logo.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://acme-legal.web.app/logo.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(evaluate(stamp.contents)).toBeUndefined();

    const declaredOnly = await buildBrandStamp('/nowhere', { ...EMPTY_BRAND, url: 'https://x.example' }, 'microteia.yaml');
    expect(declaredOnly.rewriteHtml('<meta property="og:image" content="/logo.png" />'))
      .toBe('<meta property="og:image" content="https://x.example/logo.png" />');
  });

  it('deixa a referência de mensagem fora do HTML, onde ela não se resolve', async () => {
    const stamp = await buildBrandStamp('/nowhere', declared({ tagline: '@com.acme.brand/tagline' }), 'microteia.yaml');
    const html = stamp.rewriteHtml('<title>Microteia</title>');
    expect(html).toBe('<title>Acme Legal</title>');
  });

  it('a notificação usa o ícone PNG da instalação, e sem ele o da plataforma', async () => {
    const root = await workspace();
    const branded = await buildBrandStamp(root, declared({ logo: 'brand/logo.png', icon: 'brand/icon.svg' }), 'microteia.yaml');
    const withPng = await notificationFrom(branded.contents);
    expect(withPng.options.icon).toMatch(/^\/brand\/logo-[0-9a-f]{8}\.png$/);
    expect(withPng.options.badge).toBeUndefined();

    // Só SVG: o Chrome não o desenha na notificação, então fica o ícone da plataforma.
    const svgOnly = await notificationFrom(
      (await buildBrandStamp(root, declared({ icon: 'brand/icon.svg' }), 'microteia.yaml')).contents,
    );
    expect(svgOnly.options.icon).toBe('/web-app-manifest-192x192.png');

    const platform = await notificationFrom((await buildBrandStamp(root, EMPTY_BRAND, 'microteia.yaml')).contents);
    expect(platform.options).toMatchObject({ icon: '/web-app-manifest-192x192.png', badge: '/favicon-96x96.png' });
  });

  it('o worker sobrevive ao brand.js que falta e ao carimbo antigo, que escrevia em window', async () => {
    expect((await notificationFrom(null)).options.icon).toBe('/web-app-manifest-192x192.png');
    const legacy = 'window.__MICROTEIA_BRAND__ = { "name": "Acme Legal", "logo": "/brand/logo-1.png" };';
    expect((await notificationFrom(legacy)).options.icon).toBe('/web-app-manifest-192x192.png');
    expect((await notificationFrom(await readFile(join(repoRoot, 'public', 'brand.js'), 'utf8'))).options.badge)
      .toBe('/favicon-96x96.png');
  });

  it('o pack distingue o brand.js vazio do pacote, com o exemplo em comentário, do carimbado', async () => {
    const placeholder = await readFile(join(repoRoot, 'public', 'brand.js'), 'utf8');
    expect(placeholder).toMatch(/__MICROTEIA_BRAND__ = \{/);
    expect(carriesBrandStamp(placeholder)).toBe(false);
    expect(carriesBrandStamp((await buildBrandStamp('/nowhere', EMPTY_BRAND, 'microteia.yaml')).contents)).toBe(false);
    expect(carriesBrandStamp((await buildBrandStamp('/nowhere', declared({}), 'microteia.yaml')).contents)).toBe(true);
    expect(carriesBrandStamp('window.__MICROTEIA_BRAND__ = {"name":"Acme"};')).toBe(true);
  });

  it('aplica sempre a partir do HTML original, e limpa o carimbo anterior', async () => {
    const root = await workspace();
    const install = join(root, 'install');
    await mkdir(join(install, 'hosting'), { recursive: true });
    await writeFile(join(install, 'hosting', 'index.html'), '<title>Microteia</title>');

    const branded = await buildBrandStamp(root, declared({ logo: 'brand/logo.png' }), 'microteia.yaml');
    await applyBrandStamp(install, branded);
    expect(await readFile(join(install, 'hosting', 'index.html'), 'utf8')).toBe('<title>Acme Legal</title>');
    expect(await readdir(join(install, 'hosting', 'brand'))).toHaveLength(1);
    expect(await readFile(join(install, PRISTINE_INDEX_FILE), 'utf8')).toBe('<title>Microteia</title>');

    await applyBrandStamp(install, await buildBrandStamp(root, EMPTY_BRAND, 'microteia.yaml'));
    expect(await readFile(join(install, 'hosting', 'index.html'), 'utf8')).toBe('<title>Microteia</title>');
    expect(await readdir(join(install, 'hosting'))).not.toContain('brand');
    expect(evaluate(await readFile(join(install, 'hosting', 'brand.js'), 'utf8'))).toBeUndefined();
  });
});
