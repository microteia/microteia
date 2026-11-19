import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
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
  const window: Record<string, unknown> = {};
  runInNewContext(contents, { window });
  return window.__MICROTEIA_BRAND__;
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
    expect(stamp.assets.map((asset) => `/${asset.target}`)).toEqual([parsed?.logo]);
    expect(stamp.summary).toBe('Acme Legal (logo, accent #1f6feb)');
  });

  it('reescreve o título, a descrição, as prévias de link e o ícone do index.html do kernel', async () => {
    const root = await workspace();
    const stamp = await buildBrandStamp(root, declared({
      name: 'Acme "Legal"',
      tagline: 'Legal work, simplified',
      logo: 'brand/logo.png',
      icon: 'brand/icon.svg',
    }), 'microteia.yaml');

    const html = stamp.rewriteHtml(await readFile(join(repoRoot, 'index.html'), 'utf8'));

    expect(html).not.toMatch(/Microteia/);
    expect(html).toContain('<title>Acme &quot;Legal&quot; — Legal work, simplified</title>');
    expect(html).toContain('<meta property="og:title" content="Acme &quot;Legal&quot; — Legal work, simplified" />');
    expect(html).toContain('<meta name="twitter:description" content="Legal work, simplified" />');
    expect(html).toMatch(/<meta property="og:image" content="\/brand\/logo-[0-9a-f]{8}\.png" \/>/);
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/brand\/icon-[0-9a-f]{8}\.svg" \/>/);
  });

  it('deixa a referência de mensagem fora do HTML, onde ela não se resolve', async () => {
    const stamp = await buildBrandStamp('/nowhere', declared({ tagline: '@com.acme.brand/tagline' }), 'microteia.yaml');
    const html = stamp.rewriteHtml('<title>Microteia</title>');
    expect(html).toBe('<title>Acme Legal</title>');
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
