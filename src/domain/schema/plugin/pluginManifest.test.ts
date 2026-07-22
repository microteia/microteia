import { describe, it, expect } from 'vitest';
import { hasErrors } from './diagnostics';
import type { ExtensionPointDefinition } from './extensionPoint';
import { isKernelCompatible, isValidPluginId, validatePluginManifest } from './pluginManifest';
import type { PluginManifest } from './pluginManifest';

const uiPage: ExtensionPointDefinition = {
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.kernel',
  allowedImplKinds: ['code', 'widget'],
  implRequired: true,
  multiple: true,
};

const points = new Map<string, ExtensionPointDefinition>([[uiPage.id, uiPage]]);

const manifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  id: 'com.acme.contratos',
  version: '1.0.0',
  kernel: '^1.0.0',
  name: 'Contratos Acme',
  ...overrides,
});

describe('isValidPluginId', () => {
  it.each(['com.acme.contratos', 'core.ui', 'br.com.acme.x', 'com.acme-labs.x'])('aceita "%s"', (id) =>
    expect(isValidPluginId(id)).toBe(true),
  );

  it.each(['acme', 'Com.Acme.X', 'com..acme', '.com.acme', 'com.acme.', '1com.acme', ''])(
    'rejeita "%s"',
    (id) => expect(isValidPluginId(id)).toBe(false),
  );
});

describe('isKernelCompatible', () => {
  it('aceita kernel dentro da faixa', () => {
    expect(isKernelCompatible(manifest({ kernel: '^1.0.0' }), '1.4.0')).toBe(true);
  });

  it('rejeita kernel de outro major', () => {
    expect(isKernelCompatible(manifest({ kernel: '^1.0.0' }), '2.0.0')).toBe(false);
  });

  it('rejeita faixa inválida sem lançar', () => {
    expect(isKernelCompatible(manifest({ kernel: 'qualquer' }), '1.0.0')).toBe(false);
  });
});

describe('validatePluginManifest', () => {
  it('aceita o manifest mínimo válido', () => {
    expect(validatePluginManifest(manifest())).toEqual([]);
  });

  it('nunca lança para entrada que não é objeto', () => {
    expect(validatePluginManifest(null as unknown as PluginManifest)).toEqual([
      expect.objectContaining({ code: 'manifest.invalid' }),
    ]);
    expect(validatePluginManifest([] as unknown as PluginManifest)).toHaveLength(1);
  });

  it('reporta id, versão, faixa de kernel e nome de uma vez', () => {
    const diagnostics = validatePluginManifest({
      id: 'acme',
      version: '1',
      kernel: 'xx',
      name: '  ',
    } as PluginManifest);
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'manifest.field.missing',
      'manifest.id.invalid',
      'manifest.kernel.invalid',
      'manifest.version.invalid',
    ]);
  });

  it('reporta incompatibilidade com o kernel em execução', () => {
    const diagnostics = validatePluginManifest(manifest({ kernel: '^2.0.0' }), { kernelVersion: '1.0.0' });
    expect(diagnostics[0]).toMatchObject({ code: 'manifest.kernel.incompatible' });
    expect(diagnostics[0].message).toContain('1.0.0');
  });

  it('não checa compatibilidade quando a faixa já é inválida', () => {
    const diagnostics = validatePluginManifest(manifest({ kernel: 'xx' }), { kernelVersion: '1.0.0' });
    expect(diagnostics.map((d) => d.code)).toEqual(['manifest.kernel.invalid']);
  });

  it('valida dependências', () => {
    const diagnostics = validatePluginManifest(
      manifest({ dependencies: { 'com.other.x': '^1.0.0', invalido: 'yy' } }),
    );
    expect(diagnostics.map((d) => d.code).sort()).toEqual(['dependency.range.invalid', 'manifest.id.invalid']);
  });

  it('rejeita dependências que não são objeto', () => {
    const diagnostics = validatePluginManifest(
      manifest({ dependencies: [] as unknown as Record<string, string> }),
    );
    expect(diagnostics[0]).toMatchObject({ code: 'manifest.invalid', path: 'dependencies' });
  });

  it('encaminha permissões, provisões e requisitos para seus validadores', () => {
    const diagnostics = validatePluginManifest(
      manifest({
        permissions: ['lixo'],
        provides: [{ capability: 'ai', version: '1.0.0' }],
        consumes: [{ capability: 'ai.completion', range: 'zz' }],
      }),
    );
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'capability.id.invalid',
      'capability.range.invalid',
      'permission.invalid',
    ]);
  });

  it('reporta ponto de extensão duplicado dentro do plugin', () => {
    const diagnostics = validatePluginManifest(
      manifest({ extensionPoints: [{ ...uiPage, id: 'acme.slot' }, { ...uiPage, id: 'acme.slot' }] }),
    );
    expect(diagnostics.map((d) => d.code)).toContain('extensionPoint.duplicate');
  });

  it('valida contribuições contra os pontos conhecidos do kernel', () => {
    const diagnostics = validatePluginManifest(
      manifest({
        contributes: [
          { point: 'ui.page', id: 'tela', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'widget', spec: {} } },
        ],
      }),
      { points },
    );
    expect(diagnostics).toEqual([]);
  });

  it('um plugin pode contribuir para um ponto que ele mesmo declara', () => {
    const diagnostics = validatePluginManifest(
      manifest({
        extensionPoints: [{ ...uiPage, id: 'acme.slot', ownerPluginId: 'com.acme.contratos' }],
        contributes: [
          { point: 'acme.slot', id: 'meu', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'widget', spec: {} } },
        ],
      }),
    );
    expect(diagnostics).toEqual([]);
  });

  it('recusa contribuição para ponto desconhecido, sem invalidar o manifest inteiro', () => {
    const diagnostics = validatePluginManifest(
      manifest({
        contributes: [
          { point: 'ui.page', id: 'ok', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'widget', spec: {} } },
          { point: 'ui.inexistente', id: 'nok', apiVersion: '1.0.0', metadata: {} },
        ],
      }),
      { points },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.point.unknown', contributionId: 'nok' });
  });

  it('bloqueia impl "code" por padrão e libera para plugin confiável', () => {
    const withCode = manifest({
      contributes: [
        { point: 'ui.page', id: 'tela', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'code', key: 'X' } },
      ],
    });
    expect(hasErrors(validatePluginManifest(withCode, { points }))).toBe(true);
    expect(validatePluginManifest(withCode, { points, trusted: true })).toEqual([]);
  });

  it('reporta contribuição duplicada', () => {
    const duplicated = {
      point: 'ui.page',
      id: 'tela',
      apiVersion: '1.0.0',
      metadata: {},
      impl: { kind: 'widget' as const, spec: {} },
    };
    const diagnostics = validatePluginManifest(manifest({ contributes: [duplicated, duplicated] }), { points });
    expect(diagnostics.map((d) => d.code)).toContain('contribution.duplicate');
  });

  it('carimba o pluginId em todo diagnóstico de contribuição', () => {
    const diagnostics = validatePluginManifest(
      manifest({ contributes: [{ point: 'ui.page', id: 'INVÁLIDO', apiVersion: '1.0.0', metadata: {} }] }),
      { points },
    );
    expect(diagnostics.every((d) => d.pluginId === 'com.acme.contratos')).toBe(true);
  });
});
