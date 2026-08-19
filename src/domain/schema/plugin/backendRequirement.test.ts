import { describe, expect, it } from 'vitest';
import {
  backendFingerprint,
  hasBackendRequirement,
  validateBackendRequirement,
} from './backendRequirement';
import type { PluginBackendRequirement } from './backendRequirement';
import { validatePluginManifest } from './pluginManifest';
import type { PluginManifest } from './pluginManifest';

const index = (collectionGroup: string) => ({
  collectionGroup,
  queryScope: 'COLLECTION' as const,
  fields: [
    { fieldPath: 'status', order: 'ASCENDING' as const },
    { fieldPath: 'dueDate', order: 'DESCENDING' as const },
  ],
});

describe('exigência de backend de uma extensão', () => {
  it('só existe quando pede function, índice ou parâmetro — prosa sozinha não conta', () => {
    expect(hasBackendRequirement(undefined)).toBe(false);
    expect(hasBackendRequirement({})).toBe(false);
    expect(hasBackendRequirement({ prerequisites: [{ id: 'a', title: 'b', detail: 'c' }] })).toBe(false);
    expect(hasBackendRequirement({ functions: ['gmailPush'] })).toBe(true);
    expect(hasBackendRequirement({ indexes: [index('pushes')] })).toBe(true);
    expect(hasBackendRequirement({ parameters: ['GOOGLE_CLIENT_ID'] })).toBe(true);
  });

  it('o fingerprint não muda com a ordem — a mesma exigência escrita de outro jeito é a mesma', () => {
    const a: PluginBackendRequirement = {
      functions: ['gmailPush', 'exchangeGmailCode'],
      parameters: ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID'],
      indexes: [index('pushes'), index('deadlines')],
    };
    const b: PluginBackendRequirement = {
      functions: ['exchangeGmailCode', 'gmailPush'],
      parameters: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      indexes: [index('deadlines'), index('pushes')],
    };
    expect(backendFingerprint(a)).toBe(backendFingerprint(b));
  });

  it('o fingerprint IGNORA os pré-requisitos: corrigir um texto não re-pendura o que funciona', () => {
    const base = { functions: ['gmailPush'] };
    expect(backendFingerprint({ ...base, prerequisites: [{ id: 'x', title: 'antes', detail: 'a' }] }))
      .toBe(backendFingerprint({ ...base, prerequisites: [{ id: 'x', title: 'depois', detail: 'b' }] }));
  });

  it('o fingerprint MUDA quando a exigência muda — é o que devolve a extensão para pendente', () => {
    expect(backendFingerprint({ functions: ['gmailPush'] }))
      .not.toBe(backendFingerprint({ functions: ['gmailPush', 'renewGmailWatches'] }));
    expect(backendFingerprint({ indexes: [index('pushes')] }))
      .not.toBe(backendFingerprint({ indexes: [index('deadlines')] }));
  });

  it('sem exigência, o fingerprint de nada é igual ao de um objeto vazio', () => {
    expect(backendFingerprint(undefined)).toBe(backendFingerprint({}));
  });

  it('nunca lança: toda forma inválida vira diagnóstico', () => {
    const cases: unknown[] = [
      'texto', 42, [], null,
      { functions: 'gmailPush' },
      { functions: ['2invalido'] },
      { parameters: ['minusculo'] },
      { parameters: 'GOOGLE_CLIENT_ID' },
      { indexes: {} },
      { indexes: [{ queryScope: 'COLLECTION', fields: [] }] },
      { indexes: [{ collectionGroup: 'pushes', queryScope: 'OUTRO', fields: [] }] },
      { indexes: [{ collectionGroup: 'pushes', queryScope: 'COLLECTION', fields: [{ fieldPath: 'a' }] }] },
      { indexes: [{ collectionGroup: 'pushes', queryScope: 'COLLECTION', fields: [{}, {}] }] },
    ];
    for (const value of cases) {
      const diagnostics = validateBackendRequirement(value as PluginBackendRequirement, 'com.acme.x');
      expect(diagnostics.length, JSON.stringify(value)).toBeGreaterThan(0);
      expect(diagnostics.every((diagnostic) => diagnostic.severity === 'error')).toBe(true);
    }
    expect(validateBackendRequirement(undefined, 'com.acme.x')).toEqual([]);
  });

  it('um índice de UM campo é recusado: o Firestore já o indexa sozinho', () => {
    const diagnostics = validateBackendRequirement(
      { indexes: [{ collectionGroup: 'pushes', queryScope: 'COLLECTION', fields: [{ fieldPath: 'status' }] }] },
      'com.acme.x',
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].path).toBe('backend.indexes[0]');
  });

  it('a exigência entra na validação do manifest, e o diagnóstico descarta a extensão inteira', () => {
    const manifest = {
      id: 'com.acme.x',
      version: '1.0.0',
      kernel: '^1.0.0',
      name: 'Acme',
      backend: { functions: ['nome invalido'] },
    } as unknown as PluginManifest;
    const diagnostics = validatePluginManifest(manifest, { validateContributions: false });
    const backend = diagnostics.filter((diagnostic) => diagnostic.path?.startsWith('backend'));
    expect(backend).toHaveLength(1);
    // Sem `contributionIndex`, o diagnóstico é do MANIFEST: não há como carregar meia extensão cuja
    // Cloud Function não existe.
    expect(backend[0].contributionIndex).toBeUndefined();
  });
});
