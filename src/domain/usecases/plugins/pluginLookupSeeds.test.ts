import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { packageLookupSeedIssues } from './pluginLookupSeeds';

const pkg = (kernel: string, lookups: unknown[]): MarketplacePlugin =>
  ({ manifest: { id: 'com.acme.x', version: '1.0.0', kernel, name: 'X' }, summary: '', workflows: [], lookups } as unknown as MarketplacePlugin);

const OPTIONS = [{ key: 'a', label: 'A' }];

describe('packageLookupSeedIssues', () => {
  it('recusa um modo de semeadura que não existe', () => {
    expect(packageLookupSeedIssues(pkg('^2.71.0', [{ collection: 'x', label: 'X', options: OPTIONS, seed: 'always' }])))
      .toEqual([expect.objectContaining({ message: '@core.marketplace/issue.lookup.seed-mode' })]);
  });

  it('semeadura obrigatória e lista do kernel exigem o kernel em que existem', () => {
    const required = [{ collection: 'x', label: 'X', options: OPTIONS, seed: 'required' }];
    const kernelList = [{ collection: 'documentTypes', label: 'Tipos', options: OPTIONS }];
    for (const lookups of [required, kernelList]) {
      expect(packageLookupSeedIssues(pkg('^2.70.0', lookups)))
        .toEqual([expect.objectContaining({ message: '@core.marketplace/issue.lookup.seed-kernel', messageParams: expect.objectContaining({ minimum: '2.71.0' }) })]);
      expect(packageLookupSeedIssues(pkg('^2.71.0', lookups))).toEqual([]);
    }
  });

  it('a semeadura de sempre (lista vazia, lista do pacote) não exige nada', () => {
    expect(packageLookupSeedIssues(pkg('^2.0.0', [{ collection: 'x', label: 'X', options: OPTIONS }]))).toEqual([]);
  });
});
