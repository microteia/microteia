import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../shared/paths.js';
import {
  backendFingerprint,
  baselineFunctionsOf,
  baselineIndexesOf,
  claimedFunctions,
  claimsFromTemplates,
  functionClaimProblems,
  indexDeclarationProblems,
  indexKey,
} from './backendShape.js';
import type { BackendClaim, FirestoreIndexSpec } from './backendShape.js';
import { exportedFunctionNames } from './manifest.js';

const templates = (): { manifest?: Record<string, unknown> }[] => {
  const dir = join(repoRoot, 'extension-templates');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as { manifest?: Record<string, unknown> });
};

const rootIndexes = (): FirestoreIndexSpec[] =>
  (JSON.parse(readFileSync(join(repoRoot, 'firestore.indexes.json'), 'utf8')) as {
    indexes: FirestoreIndexSpec[];
  }).indexes;

const allFunctions = (): string[] =>
  exportedFunctionNames(readFileSync(join(repoRoot, 'functions/src/index.ts'), 'utf8'));

describe('paridade do fingerprint entre o kernel e o Console', () => {
  /**
   * Separados em silêncio, o Console gravaria um carimbo que o kernel nunca reconhece — e a extensão
   * ficaria pendente para sempre, sem erro em lugar nenhum. Este teste compara as duas implementações
   * sobre os mesmos valores, em vez de comparar o texto das duas funções.
   */
  it('as duas implementações produzem a mesma string', async () => {
    const kernel = await import('../../../src/domain/schema/plugin/backendRequirement.js');
    const cases = [
      undefined,
      {},
      { functions: ['gmailPush', 'exchangeGmailCode'] },
      { parameters: ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID'] },
      {
        functions: ['b', 'a'],
        parameters: ['Z', 'A'],
        indexes: [
          {
            collectionGroup: 'pushes',
            queryScope: 'COLLECTION' as const,
            fields: [
              { fieldPath: 'emailId', order: 'ASCENDING' as const },
              { fieldPath: 'processNumber', order: 'ASCENDING' as const },
            ],
          },
          {
            collectionGroup: 'deadlines',
            queryScope: 'COLLECTION_GROUP' as const,
            fields: [{ fieldPath: 'tags', arrayConfig: 'CONTAINS' as const }, { fieldPath: 'dueDate' }],
          },
        ],
      },
      { prerequisites: [{ id: 'x', title: 'y', detail: 'z' }] },
    ];

    for (const value of cases) {
      expect(backendFingerprint(value), JSON.stringify(value)).toBe(kernel.backendFingerprint(value));
    }
  });
});

describe('baseline e reivindicado — as contas do pacote', () => {
  it('baseline ∪ reivindicado é exatamente o que o index.ts exporta', () => {
    const all = allFunctions();
    const claims = claimsFromTemplates(templates());
    const baseline = baselineFunctionsOf(all, claims);
    const claimed = claimedFunctions(claims);

    expect([...baseline, ...claimed].sort()).toEqual([...all].sort());
    // Nenhuma function em dois lugares: o `--prune` decide pela ausência de dono, e um nome em ambos
    // seria removido de uma instalação que ainda o usa.
    expect(baseline.filter((name) => claimed.includes(name))).toEqual([]);
  });

  it('a baseline preserva a ordem do index.ts — é a ordem do deploy uma-a-uma', () => {
    const all = allFunctions();
    const baseline = baselineFunctionsOf(all, claimsFromTemplates(templates()));
    expect(baseline).toEqual(all.filter((name) => baseline.includes(name)));
  });

  it('toda function reivindicada existe no pacote, e nenhuma tem dois donos', () => {
    expect(functionClaimProblems(claimsFromTemplates(templates()), allFunctions())).toEqual([]);
  });

  it('todo índice reivindicado está declarado na raiz — declarar não pode inventar índice', () => {
    expect(indexDeclarationProblems(claimsFromTemplates(templates()), rootIndexes())).toEqual([]);
  });

  it('baseline de índices e reivindicados não se sobrepõem, e juntos são a raiz', () => {
    const claims = claimsFromTemplates(templates());
    const root = rootIndexes();
    const baseline = baselineIndexesOf(root, claims);
    const claimedKeys = new Set(claims.flatMap((claim) => (claim.backend.indexes ?? []).map(indexKey)));

    expect(baseline.some((index) => claimedKeys.has(indexKey(index)))).toBe(false);
    expect(baseline.length + claimedKeys.size).toBe(root.length);
  });

  it('o Push é o caso que motivou tudo isto: as 5 functions do Gmail saem da baseline', () => {
    const claims = claimsFromTemplates(templates());
    const push = claims.find((claim) => claim.pluginId === 'com.microteia.push');
    expect(push, 'com.microteia.push deve declarar manifest.backend').toBeDefined();
    expect([...(push?.backend.functions ?? [])].sort()).toEqual([
      'exchangeGmailCode', 'gmailPush', 'listGmailConnections', 'renewGmailWatches', 'revokeGmailConnection',
    ]);

    const baseline = baselineFunctionsOf(allFunctions(), claims);
    expect(baseline).not.toContain('gmailPush');
    // O que é do kernel continua na baseline, ou uma instalação nova subiria sem motor de automações.
    expect(baseline).toContain('onWorkflowEventCreated');
    expect(baseline).toContain('callAIProxy');
  });

  it('reivindicação inválida é NOMEADA, e não silenciada', () => {
    const claim: BackendClaim = {
      pluginId: 'com.acme.x',
      name: 'Acme',
      version: '1.0.0',
      backend: { functions: ['naoExiste'] },
    };
    const problems = functionClaimProblems([claim], allFunctions());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.x');
    expect(problems[0]).toContain('naoExiste');
  });

  it('duas extensões donas da mesma function é problema, e o relato nomeia as duas', () => {
    const claim = (pluginId: string): BackendClaim => ({
      pluginId, name: pluginId, version: '1.0.0', backend: { functions: ['gmailPush'] },
    });
    const problems = functionClaimProblems([claim('com.acme.a'), claim('com.acme.b')], allFunctions());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.a');
    expect(problems[0]).toContain('com.acme.b');
  });
});
