import { describe, it, expect } from 'vitest';
import type { Contribution } from '../domain/schema/plugin/contribution';
import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';
import type { PluginManifest } from '../domain/schema/plugin/pluginManifest';
import { createPluginHost } from './PluginHost';
import type { PluginRecord } from './PluginHost';

const uiPage: ExtensionPointDefinition = {
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.ui',
  allowedImplKinds: ['code', 'widget'],
  implRequired: false,
  multiple: true,
};

const kernelPlugin = (points: ExtensionPointDefinition[] = [uiPage]): PluginRecord => ({
  trusted: true,
  manifest: {
    id: 'core.ui',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Núcleo de UI',
    extensionPoints: points,
  },
});

const manifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  id: 'com.acme.contratos',
  version: '1.0.0',
  kernel: '^1.0.0',
  name: 'Contratos Acme',
  ...overrides,
});

const pageContribution = (id: string, overrides: Partial<Contribution> = {}): Contribution => ({
  point: 'ui.page',
  id,
  apiVersion: '1.0.0',
  metadata: { title: id },
  ...overrides,
});

const codes = (host: ReturnType<typeof createPluginHost>) =>
  host.diagnostics().map((diagnostic) => diagnostic.code);

describe('createPluginHost — carga básica', () => {
  it('carrega uma lista vazia sem reclamar', () => {
    const host = createPluginHost();
    const result = host.load([]);

    expect(result).toMatchObject({ loaded: [], skipped: [], diagnostics: [] });
    expect(host.loadedIds()).toEqual([]);
  });

  it('carrega um plugin e registra suas contribuições', () => {
    const host = createPluginHost();
    const result = host.load([
      kernelPlugin(),
      { manifest: manifest({ contributes: [pageContribution('contratos')] }) },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.loaded).toEqual(['com.acme.contratos', 'core.ui']);
    expect(host.isLoaded('com.acme.contratos')).toBe(true);
    expect(host.contributions.query('ui.page').map((c) => c.id)).toEqual(['contratos']);
    expect(host.contributions.query('ui.page')[0].pluginId).toBe('com.acme.contratos');
  });

  it('expõe o manifest carregado e nada do que foi pulado', () => {
    const host = createPluginHost();
    host.load([{ manifest: manifest({ kernel: '^9.0.0' }) }]);

    expect(host.manifestOf('com.acme.contratos')).toBeUndefined();
    expect(host.isLoaded('com.acme.contratos')).toBe(false);
  });

  it('registra os provimentos de capability', () => {
    const host = createPluginHost();
    host.load([
      { manifest: manifest({ provides: [{ capability: 'ai.completion', version: '1.0.0' }] }) },
    ]);

    expect(host.capabilities.resolve({ capability: 'ai.completion', range: '^1.0.0' })?.pluginId).toBe(
      'com.acme.contratos',
    );
  });

  it('ignora a segunda declaração do mesmo id', () => {
    const host = createPluginHost();
    const result = host.load([{ manifest: manifest() }, { manifest: manifest({ name: 'Cópia' }) }]);

    expect(result.diagnostics.map((d) => d.code)).toEqual(['manifest.duplicate']);
    expect(host.manifestOf('com.acme.contratos')?.name).toBe('Contratos Acme');
  });
});

describe('createPluginHost — isolamento de falha', () => {
  it('pula o plugin com manifest inválido sem derrubar os outros', () => {
    const host = createPluginHost();
    const result = host.load([
      kernelPlugin(),
      { manifest: manifest({ id: 'invalido' }) },
      { manifest: manifest({ id: 'com.acme.bom', contributes: [pageContribution('ok')] }) },
    ]);

    expect(result.loaded).toEqual(['com.acme.bom', 'core.ui']);
    expect(result.skipped).toEqual(['invalido']);
    expect(host.contributions.query('ui.page')).toHaveLength(1);
  });

  it('pula o plugin incompatível com o kernel em execução', () => {
    const host = createPluginHost({ kernelVersion: '1.0.0' });
    const result = host.load([{ manifest: manifest({ kernel: '^2.0.0' }) }]);

    expect(result.skipped).toEqual(['com.acme.contratos']);
    expect(codes(host)).toContain('manifest.kernel.incompatible');
  });

  it('descarta SÓ a contribuição inválida, mantendo as demais do mesmo plugin', () => {
    const host = createPluginHost();
    host.load([
      kernelPlugin(),
      {
        manifest: manifest({
          contributes: [
            pageContribution('boa'),
            pageContribution('ruim', { point: 'ui.inexistente' }),
            pageContribution('outra-boa'),
          ],
        }),
      },
    ]);

    expect(host.isLoaded('com.acme.contratos')).toBe(true);
    expect(host.contributions.query('ui.page').map((c) => c.id)).toEqual(['boa', 'outra-boa']);
    expect(codes(host)).toEqual(['contribution.point.unknown']);
  });

  it('descarta contribuição com contrato de major incompatível', () => {
    const host = createPluginHost();
    host.load([
      kernelPlugin([{ ...uiPage, apiVersion: '2.0.0' }]),
      { manifest: manifest({ contributes: [pageContribution('velha', { apiVersion: '1.0.0' })] }) },
    ]);

    expect(host.contributions.query('ui.page')).toEqual([]);
    expect(codes(host)).toContain('contribution.point.incompatible');
  });
});

describe('createPluginHost — dependências', () => {
  const base = () => [
    kernelPlugin(),
    { manifest: manifest({ id: 'com.acme.base', version: '2.0.0' }) },
  ];

  it('ordena a dependência antes de quem depende dela', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.filho', dependencies: { 'com.acme.base': '^2.0.0' } }) },
      ...base(),
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.loaded.indexOf('com.acme.base')).toBeLessThan(result.loaded.indexOf('com.acme.filho'));
  });

  it('pula quem depende de plugin ausente', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.filho', dependencies: { 'com.acme.sumido': '^1.0.0' } }) },
    ]);

    expect(result.loaded).toEqual([]);
    expect(codes(host)).toEqual(['dependency.missing']);
  });

  it('pula quem depende de versão que não bate', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.filho', dependencies: { 'com.acme.base': '^3.0.0' } }) },
      ...base(),
    ]);

    expect(result.loaded).not.toContain('com.acme.filho');
    expect(codes(host)).toContain('dependency.unsatisfied');
  });

  it('propaga em cascata: quem depende de um plugin pulado também é pulado', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.quebrado', kernel: '^9.0.0' }) },
      { manifest: manifest({ id: 'com.acme.meio', dependencies: { 'com.acme.quebrado': '^1.0.0' } }) },
      { manifest: manifest({ id: 'com.acme.folha', dependencies: { 'com.acme.meio': '^1.0.0' } }) },
    ]);

    expect(result.loaded).toEqual([]);
    expect(result.skipped).toEqual(['com.acme.folha', 'com.acme.meio', 'com.acme.quebrado']);
    expect(codes(host)).toContain('dependency.disabled');
  });

  it('detecta ciclo e pula todos os envolvidos, sem travar', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.a', dependencies: { 'com.acme.b': '^1.0.0' } }) },
      { manifest: manifest({ id: 'com.acme.b', dependencies: { 'com.acme.a': '^1.0.0' } }) },
      { manifest: manifest({ id: 'com.acme.livre' }) },
    ]);

    expect(result.loaded).toEqual(['com.acme.livre']);
    expect(result.skipped).toEqual(['com.acme.a', 'com.acme.b']);
    expect(host.diagnostics().filter((d) => d.code === 'dependency.cycle')).toHaveLength(2);
  });

  it('detecta autodependência', () => {
    const host = createPluginHost();
    const result = host.load([
      { manifest: manifest({ id: 'com.acme.a', dependencies: { 'com.acme.a': '^1.0.0' } }) },
    ]);

    expect(result.loaded).toEqual([]);
    expect(codes(host)).toContain('dependency.cycle');
  });
});

describe('createPluginHost — implementações em código', () => {
  const withImpl = (overrides: Partial<PluginRecord> = {}): PluginRecord => ({
    trusted: true,
    implementations: { PaginaContratos: () => 'render' },
    manifest: manifest({
      contributes: [pageContribution('contratos', { impl: { kind: 'code', key: 'PaginaContratos' } })],
    }),
    ...overrides,
  });

  it('registra a tabela de implementações do plugin interno', () => {
    const host = createPluginHost();
    host.load([kernelPlugin(), withImpl()]);

    expect(host.implementations.has('com.acme.contratos', 'PaginaContratos')).toBe(true);
    expect(host.contributions.query('ui.page')).toHaveLength(1);
  });

  it('descarta a contribuição cuja implementação não foi fornecida', () => {
    const host = createPluginHost();
    host.load([kernelPlugin(), withImpl({ implementations: {} })]);

    expect(host.contributions.query('ui.page')).toEqual([]);
    expect(codes(host)).toContain('contribution.impl.unresolved');
  });

  it('ignora implementações de plugin não confiável e recusa a contribuição', () => {
    const host = createPluginHost();
    host.load([kernelPlugin(), withImpl({ trusted: false })]);

    expect(host.implementations.size()).toBe(0);
    expect(host.contributions.query('ui.page')).toEqual([]);
    expect(codes(host)).toContain('contribution.impl.forbidden');
  });
});

describe('createPluginHost — conflitos e capabilities', () => {
  it('avisa quando um ponto de contribuição única recebe mais de uma', () => {
    const host = createPluginHost();
    host.load([
      kernelPlugin([{ ...uiPage, id: 'ui.theme', multiple: false, implRequired: false }]),
      { manifest: manifest({ id: 'com.acme.a', contributes: [pageContribution('t', { point: 'ui.theme' })] }) },
      { manifest: manifest({ id: 'com.acme.b', contributes: [pageContribution('t', { point: 'ui.theme' })] }) },
    ]);

    const conflict = host.diagnostics().find((d) => d.code === 'contribution.conflict');
    expect(conflict).toMatchObject({ severity: 'warning', pluginId: 'com.acme.a' });
    expect(host.contributions.queryOne('ui.theme')?.pluginId).toBe('com.acme.a');
  });

  it('avisa quando uma capability exigida não tem provedor', () => {
    const host = createPluginHost();
    host.load([
      { manifest: manifest({ consumes: [{ capability: 'messaging.whatsapp', range: '^1.0.0' }] }) },
    ]);

    const unsatisfied = host.diagnostics().find((d) => d.code === 'capability.unsatisfied');
    expect(unsatisfied?.severity).toBe('warning');
    expect(host.isLoaded('com.acme.contratos')).toBe(true);
  });

  it('não avisa quando a capability exigida é opcional', () => {
    const host = createPluginHost();
    host.load([
      {
        manifest: manifest({
          consumes: [{ capability: 'messaging.whatsapp', range: '^1.0.0', optional: true }],
        }),
      },
    ]);

    expect(codes(host)).not.toContain('capability.unsatisfied');
  });

  it('não avisa quando algum plugin fornece a capability', () => {
    const host = createPluginHost();
    host.load([
      { manifest: manifest({ id: 'com.acme.zap', provides: [{ capability: 'messaging.whatsapp', version: '1.4.0' }] }) },
      { manifest: manifest({ consumes: [{ capability: 'messaging.whatsapp', range: '^1.0.0' }] }) },
    ]);

    expect(codes(host)).not.toContain('capability.unsatisfied');
  });
});

describe('createPluginHost — remoção limpa', () => {
  const world = (): PluginRecord[] => [
    kernelPlugin(),
    {
      trusted: true,
      implementations: { Pagina: () => 'x' },
      manifest: manifest({
        id: 'com.acme.removivel',
        provides: [{ capability: 'ai.completion', version: '1.0.0' }],
        extensionPoints: [{ ...uiPage, id: 'acme.slot', ownerPluginId: 'com.acme.removivel' }],
        contributes: [pageContribution('tela', { impl: { kind: 'code', key: 'Pagina' } })],
      }),
    },
    { manifest: manifest({ id: 'com.acme.fica', contributes: [pageContribution('fica') ] }) },
  ];

  it('recarregar sem um plugin apaga TODO rastro dele', () => {
    const host = createPluginHost();
    host.load(world());

    expect(host.contributions.query('ui.page')).toHaveLength(2);
    expect(host.points.has('acme.slot')).toBe(true);

    const result = host.load(world().filter((record) => record.manifest.id !== 'com.acme.removivel'));

    expect(result.loaded).toEqual(['com.acme.fica', 'core.ui']);
    expect(host.isLoaded('com.acme.removivel')).toBe(false);
    expect(host.contributions.query('ui.page').map((c) => c.id)).toEqual(['fica']);
    expect(host.points.has('acme.slot')).toBe(false);
    expect(host.implementations.size()).toBe(0);
    expect(host.capabilities.resolve({ capability: 'ai.completion', range: '^1.0.0' })).toBeNull();
    expect(host.diagnosticsOf('com.acme.removivel')).toEqual([]);
  });

  it('recarregar o mesmo mundo é idempotente', () => {
    const host = createPluginHost();
    const first = host.load(world());
    const second = host.load(world());

    expect(second.loaded).toEqual(first.loaded);
    expect(second.diagnostics).toEqual(first.diagnostics);
    expect(host.contributions.size()).toBe(2);
  });
});

describe('createPluginHost — escala', () => {
  it('carrega 500 plugins encadeados em ordem topológica', () => {
    const records: PluginRecord[] = [kernelPlugin()];
    for (let index = 0; index < 500; index += 1) {
      const id = `com.acme.p${String(index).padStart(3, '0')}`;
      const previous = `com.acme.p${String(index - 1).padStart(3, '0')}`;
      records.push({
        manifest: manifest({
          id,
          dependencies: index === 0 ? undefined : { [previous]: '^1.0.0' },
          contributes: [pageContribution(`tela-${index}`)],
        }),
      });
    }

    const host = createPluginHost();
    const started = performance.now();
    const result = host.load(records.reverse());
    const elapsed = performance.now() - started;

    expect(result.diagnostics).toEqual([]);
    expect(result.loaded).toHaveLength(501);
    expect(host.contributions.query('ui.page')).toHaveLength(500);
    expect(result.loaded.indexOf('com.acme.p000')).toBeLessThan(result.loaded.indexOf('com.acme.p499'));
    expect(elapsed).toBeLessThan(2000);
  });

  it('a ordem de entrada não muda o resultado', () => {
    const records = [
      kernelPlugin(),
      { manifest: manifest({ id: 'com.acme.a', contributes: [pageContribution('a')] }) },
      { manifest: manifest({ id: 'com.acme.b', contributes: [pageContribution('b')] }) },
      { manifest: manifest({ id: 'com.acme.c', contributes: [pageContribution('c')] }) },
    ];

    const forward = createPluginHost();
    const backward = createPluginHost();
    forward.load(records);
    backward.load([...records].reverse());

    expect(backward.loadedIds()).toEqual(forward.loadedIds());
    expect(backward.contributions.query('ui.page')).toEqual(forward.contributions.query('ui.page'));
  });
});
