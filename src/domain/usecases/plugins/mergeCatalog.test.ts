import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PublishedPlugin } from '../../repositories/IPluginRegistryRepository';
import { mergeCatalog, pluginSourceOf } from './mergeCatalog';

const builtin = (id: string): MarketplacePlugin => ({
  summary: `builtin ${id}`,
  manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: id },
  workflows: [],
});

const published = (id: string, version = '2.0.0'): PublishedPlugin => ({
  summary: `published ${id}`,
  manifest: { id, version, kernel: '^1.0.0', name: id },
  workflows: [],
  publishedAt: new Date(),
  publishedBy: 'sys',
});

describe('mergeCatalog', () => {
  it('mostra só os embutidos quando nada foi publicado', () => {
    const result = mergeCatalog([], [builtin('a'), builtin('b')]);
    expect(result.map((p) => p.manifest.id)).toEqual(['a', 'b']);
  });

  it('inclui plugins que só existem no registro (adicionados sem deploy)', () => {
    const result = mergeCatalog([published('novo')], [builtin('a')]);
    expect(result.map((p) => p.manifest.id).sort()).toEqual(['a', 'novo']);
  });

  it('o publicado vence o embutido de mesmo id (dedup)', () => {
    const result = mergeCatalog([published('a', '3.0.0')], [builtin('a')]);
    expect(result).toHaveLength(1);
    expect(result[0].manifest.version).toBe('3.0.0');
    expect(result[0].summary).toBe('published a');
  });

  it('não duplica: um id publicado aparece uma vez só', () => {
    const result = mergeCatalog([published('a')], [builtin('a'), builtin('b')]);
    const ids = result.map((p) => p.manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

describe('pluginSourceOf', () => {
  it('marca como published o que está no registro', () => {
    expect(pluginSourceOf([published('a')], 'a')).toBe('published');
  });

  it('marca como builtin o que não está no registro', () => {
    expect(pluginSourceOf([published('a')], 'b')).toBe('builtin');
    expect(pluginSourceOf([], 'a')).toBe('builtin');
  });
});
