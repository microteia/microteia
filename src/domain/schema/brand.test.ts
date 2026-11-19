import { describe, expect, it } from 'vitest';
import { parseStampedBrand } from './brand';

describe('parseStampedBrand', () => {
  it('devolve nulo para o placeholder do pacote e para o que não é objeto', () => {
    expect(parseStampedBrand(undefined)).toBeNull();
    expect(parseStampedBrand(null)).toBeNull();
    expect(parseStampedBrand([])).toBeNull();
    expect(parseStampedBrand('Acme')).toBeNull();
    expect(parseStampedBrand({})).toBeNull();
    expect(parseStampedBrand({ name: '   ', tagline: 'x' })).toBeNull();
  });

  it('lê a identidade completa, aparando o texto e normalizando a cor', () => {
    expect(parseStampedBrand({
      name: ' Acme Legal ',
      tagline: 'Legal work, simplified',
      description: 'Deadlines and cases in one place.',
      logo: '/brand/logo-1a2b3c4d.png',
      accent: '#1F6FEB',
    })).toEqual({
      name: 'Acme Legal',
      tagline: 'Legal work, simplified',
      description: 'Deadlines and cases in one place.',
      logo: '/brand/logo-1a2b3c4d.png',
      accent: '#1f6feb',
    });
  });

  it('descarta o logo que não é caminho da própria origem', () => {
    for (const logo of ['https://evil.example/x.png', '//evil.example/x.png', 'javascript:alert(1)', 'brand/x.png', '/\\evil']) {
      expect(parseStampedBrand({ name: 'Acme', logo })?.logo).toBeNull();
    }
  });

  it('descarta a cor que não é #rrggbb, sem perder o resto', () => {
    for (const accent of ['red', '#fff', 'rgba(0,0,0,1)', '#12345g', 42]) {
      expect(parseStampedBrand({ name: 'Acme', accent })).toEqual({
        name: 'Acme', tagline: null, description: null, logo: null, accent: null,
      });
    }
  });
});
