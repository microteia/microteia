import { describe, it, expect } from 'vitest';
import { versionArtifactOnWrite, versionWorkflowOnWrite } from './workflowVersions';
import { SCRIPT_VERSION_CONTENT_KEYS } from '../schema/workflowVersion';
import type { WorkflowVersionDeps } from './workflowVersions';
import type { WorkflowContentOrigin } from '../schema/workflowVersion';

const setup = (stored: Record<number, WorkflowContentOrigin> = {}) => {
  const saved = new Map<number, { content: Record<string, unknown>; origin: WorkflowContentOrigin }>(
    Object.entries(stored).map(([version, origin]) => [Number(version), { content: {}, origin }]),
  );
  const numbers: number[] = [];
  const deps: WorkflowVersionDeps = {
    saveVersionIfAbsent: async (_t, _d, version, content, origin) => {
      if (!saved.has(version)) saved.set(version, { content, origin });
    },
    replaceVersion: async (_t, _d, version, content, origin) => { saved.set(version, { content, origin }); },
    latestVersion: async () => {
      const versions = [...saved.keys()];
      if (versions.length === 0) return null;
      const version = Math.max(...versions);
      return { version, origin: saved.get(version)?.origin ?? null };
    },
    setDefinitionVersion: async (_t, _d, version) => { numbers.push(version); },
  };
  return { deps, saved, numbers };
};

const definition = (steps: string[], version?: number, contentOrigin?: WorkflowContentOrigin) => ({
  name: 'Cobrança',
  eventName: 'faturas.saved',
  enabled: true,
  steps: steps.map((id, order) => ({ id, order })),
  ...(version !== undefined ? { version } : {}),
  ...(contentOrigin ? { contentOrigin } : {}),
});

const extension = (sourceRev: number): WorkflowContentOrigin => ({ kind: 'extension', pluginId: 'com.acme.cobranca', sourceRev });

describe('versionWorkflowOnWrite', () => {
  it('a criação é a versão 1, como EDIÇÃO quando ninguém disse a origem', async () => {
    const { deps, saved, numbers } = setup();
    expect(await versionWorkflowOnWrite('t1', 'wf', undefined, definition(['a'], 1), deps)).toBe(1);
    expect(saved.get(1)?.origin).toEqual({ kind: 'edit' });
    expect(numbers).toEqual([]);
  });

  it('mudança de conteúdo: guarda a de antes (se faltava) e a nova, com o número do SERVIDOR', async () => {
    const { deps, saved, numbers } = setup();
    // O cliente gravou `version: 1` de novo — como a instalação de uma extensão faz.
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 3), definition(['a', 'b'], 1), deps)).toBe(4);
    expect(saved.get(3)?.content.steps).toEqual([{ id: 'a', order: 0 }]);
    expect(saved.get(4)?.content.steps).toEqual([{ id: 'a', order: 0 }, { id: 'b', order: 1 }]);
    expect(numbers).toEqual([4]);
  });

  it('a atualização da extensão em duas passadas vira UMA versão, com a origem dela', async () => {
    const { deps, saved } = setup({ 1: { kind: 'edit' } });
    const passada1 = definition(['a', 'chamar-tpl'], 1, extension(7));
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 1), passada1, deps)).toBe(2);
    const passada2 = definition(['a', 'chamar-real'], 2, extension(7));
    expect(await versionWorkflowOnWrite('t1', 'wf', { ...passada1, version: 2 }, passada2, deps)).toBe(2);

    expect([...saved.keys()]).toEqual([1, 2]);
    expect(saved.get(2)?.content.steps).toEqual([{ id: 'a', order: 0 }, { id: 'chamar-real', order: 1 }]);
    expect(saved.get(2)?.origin).toEqual(extension(7));
  });

  it('uma EDIÇÃO depois da atualização é versão nova — mesmo que a origem anterior seja a extensão', async () => {
    const { deps, saved } = setup({ 2: extension(7) });
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 2, extension(7)), definition(['b'], 2), deps)).toBe(3);
    expect(saved.get(3)?.origin).toEqual({ kind: 'edit' });
  });

  it('reinstalar com o mesmo id continua a numeração — a versão 1 de antes não é sobrescrita nem reaproveitada', async () => {
    const { deps, saved } = setup({ 1: extension(3), 2: { kind: 'edit' }, 3: extension(5) });
    expect(await versionWorkflowOnWrite('t1', 'wf', undefined, definition(['a'], 1, extension(5)), deps)).toBe(4);
    expect(saved.get(4)?.origin).toEqual(extension(5));
  });

  it('ligar/desligar e a gravação do próprio número não são versão nova', async () => {
    const { deps, saved } = setup();
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 2), { ...definition(['a'], 2), enabled: false }, deps)).toBeNull();
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 2), definition(['a'], 3), deps)).toBeNull();
    expect(saved.size).toBe(0);
  });

  it('a exclusão mantém as versões', async () => {
    const { deps, saved } = setup({ 1: { kind: 'edit' } });
    expect(await versionWorkflowOnWrite('t1', 'wf', definition(['a'], 1), undefined, deps)).toBeNull();
    expect(saved.size).toBe(1);
  });
});

describe('versionArtifactOnWrite — o script', () => {
  const script = (sourceTs: string, extra: Record<string, unknown> = {}) => ({
    name: 'calc', sourceTs, compiledJs: sourceTs.toUpperCase(), inputParams: [], outputParams: [], ...extra,
  });

  it('código ou contrato novos são versão; os donos e o carimbo de data, não', async () => {
    const { deps, saved } = setup();
    expect(await versionArtifactOnWrite('t1', 'calc', script('a', { version: 1 }), script('b'), SCRIPT_VERSION_CONTENT_KEYS, deps)).toBe(2);
    expect(saved.get(2)?.content).toMatchObject({ sourceTs: 'b', compiledJs: 'B' });
    expect(await versionArtifactOnWrite(
      't1', 'calc', script('b', { version: 2 }), script('b', { version: 2, ownerPluginIds: ['x'], updatedAt: 'agora' }),
      SCRIPT_VERSION_CONTENT_KEYS, deps,
    )).toBeNull();
  });
});

