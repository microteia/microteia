import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import {
  compareByMetric,
  extensionGlyphOf,
  extensionImageOf,
  publisherVerificationOf,
  ratingAverage,
  starsOf,
} from './extensionReputation';
import { EXTENSION_IMAGE_MAX_BYTES, packageImageIssues } from './pluginImage';
import { packageIssues } from './pluginReferences';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const pkg = (manifest: Partial<MarketplacePlugin['manifest']> = {}, rest: Partial<MarketplacePlugin> = {}): MarketplacePlugin => ({
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X', ...manifest },
  summary: 'x',
  workflows: [],
  ...rest,
});

describe('imagem da extensão', () => {
  it('aceita data: URI de PNG, JPEG, WebP e SVG', () => {
    for (const type of ['png', 'jpeg', 'webp', 'svg+xml']) {
      expect(packageImageIssues(pkg({ image: `data:image/${type};base64,AAAA` }))).toEqual([]);
    }
  });

  it('o pacote sem imagem continua passando — o campo é opcional', () => {
    expect(packageImageIssues(pkg())).toEqual([]);
  });

  it('recusa URL externa: cada lista aberta avisaria um servidor de terceiro', () => {
    expect(packageImageIssues(pkg({ image: 'https://example.com/logo.png' }))[0]?.message)
      .toBe('@core.marketplace/issue.package.image.invalid');
  });

  it('recusa formato que não é imagem', () => {
    expect(packageImageIssues(pkg({ image: 'data:text/html;base64,AAAA' }))).toHaveLength(1);
  });

  it('recusa a imagem acima do teto, dizendo o tamanho e o limite', () => {
    const big = `data:image/png;base64,${'A'.repeat(EXTENSION_IMAGE_MAX_BYTES)}`;
    const [issue] = packageImageIssues(pkg({ image: big }));
    expect(issue?.message).toBe('@core.marketplace/issue.package.image.too-large');
    expect(issue?.messageParams?.limit).toBe(String(EXTENSION_IMAGE_MAX_BYTES / 1024));
  });

  it('é cobrada pela porta única do pacote', () => {
    expect(packageIssues(pkg({ image: 'nope' })).map((issue) => issue.message))
      .toContain('@core.marketplace/issue.package.image.invalid');
  });

  it('a tela só recebe a imagem que desenharia', () => {
    expect(extensionImageOf(pkg({ image: PNG }))).toBe(PNG);
    expect(extensionImageOf(pkg({ image: 'https://example.com/a.png' }))).toBeNull();
  });
});

describe('extensionGlyphOf', () => {
  it('o ícone declarado vence', () => {
    expect(extensionGlyphOf(pkg({ icon: 'globe' }))).toBe('globe');
  });

  it('sem ícone declarado, deriva do menu que a extensão contribui', () => {
    const withNav = pkg({
      contributes: [{ point: 'ui.nav', id: 'n', apiVersion: '1.0.0', metadata: { key: 'calendar', label: 'C', icon: 'calendar' } }],
    });
    expect(extensionGlyphOf(withNav)).toBe('calendar');
  });

  it('pula o que não é chave do catálogo em vez de desenhar o marcador genérico', () => {
    expect(extensionGlyphOf(pkg({ icon: 'nao-existe' }))).toBeNull();
  });

  it('sem nada a derivar, não inventa', () => {
    expect(extensionGlyphOf(pkg())).toBeNull();
  });
});

describe('estrelas', () => {
  it('sem voto não há média', () => {
    expect(ratingAverage(undefined)).toBeNull();
    expect(ratingAverage({ id: 'x', installs: 3, ratingCount: 0, ratingSum: 0 })).toBeNull();
  });

  it('a média sai da soma e da quantidade', () => {
    expect(ratingAverage({ id: 'x', installs: 3, ratingCount: 4, ratingSum: 17 })).toBe(4.25);
  });

  it('arredonda à meia estrela mais próxima', () => {
    expect(starsOf(4.25)).toEqual(['full', 'full', 'full', 'full', 'half']);
    expect(starsOf(4.2)).toEqual(['full', 'full', 'full', 'full', 'empty']);
    expect(starsOf(5)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(starsOf(1)).toEqual(['full', 'empty', 'empty', 'empty', 'empty']);
  });
});

describe('publisherVerificationOf', () => {
  const verified = new Set(['t-verificado']);

  it('primeira parte é verificada pela procedência', () => {
    expect(publisherVerificationOf({ firstParty: true, ownerTenantId: null, verifiedPublishers: verified }))
      .toBe('first-party');
  });

  it('publicação de escritório verificado leva o selo', () => {
    expect(publisherVerificationOf({ firstParty: false, ownerTenantId: 't-verificado', verifiedPublishers: verified }))
      .toBe('verified');
  });

  it('os demais não levam selo nenhum', () => {
    expect(publisherVerificationOf({ firstParty: false, ownerTenantId: 't-outro', verifiedPublishers: verified })).toBeNull();
    expect(publisherVerificationOf({ firstParty: false, ownerTenantId: null, verifiedPublishers: verified })).toBeNull();
  });
});

describe('compareByMetric', () => {
  type Item = { name: string; value: number | null };
  const order = (items: Item[]) => [...items]
    .sort(compareByMetric((item: Item) => item.value, (a, b) => a.name.localeCompare(b.name)))
    .map((item) => item.name);

  it('maior primeiro', () => {
    expect(order([{ name: 'a', value: 1 }, { name: 'b', value: 30 }, { name: 'c', value: 4 }])).toEqual(['b', 'c', 'a']);
  });

  it('quem não tem o número vai para o fim — sem voto não é nota zero', () => {
    expect(order([{ name: 'a', value: null }, { name: 'b', value: 0 }, { name: 'c', value: 2 }])).toEqual(['c', 'b', 'a']);
  });

  it('o empate cai no desempate, para a ordem não pular', () => {
    expect(order([{ name: 'z', value: 5 }, { name: 'a', value: 5 }, { name: 'm', value: null }, { name: 'b', value: null }]))
      .toEqual(['a', 'z', 'b', 'm']);
  });
});
