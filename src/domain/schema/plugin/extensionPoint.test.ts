import { describe, it, expect } from 'vitest';
import {
  isApiVersionCompatible,
  isTrustedOnlyImplKind,
  isValidExtensionPointId,
  validateExtensionPoint,
} from './extensionPoint';
import type { ExtensionPointDefinition } from './extensionPoint';

const definition = (overrides: Partial<ExtensionPointDefinition> = {}): ExtensionPointDefinition => ({
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.kernel',
  allowedImplKinds: ['code', 'widget'],
  implRequired: true,
  multiple: true,
  ...overrides,
});

describe('isValidExtensionPointId', () => {
  it.each(['ui.page', 'workflow.step', 'ui.field.control', 'a.b'])('aceita "%s"', (id) =>
    expect(isValidExtensionPointId(id)).toBe(true),
  );

  it.each(['page', 'UI.page', 'ui.', '.page', 'ui..page', '', 'ui.page-x', '1.page'])(
    'rejeita "%s"',
    (id) => expect(isValidExtensionPointId(id)).toBe(false),
  );
});

describe('isTrustedOnlyImplKind', () => {
  it('marca "code" como exclusivo de plugin interno', () => {
    expect(isTrustedOnlyImplKind('code')).toBe(true);
  });

  it.each(['script', 'widget', 'workflow'] as const)('libera "%s" para terceiros', (kind) =>
    expect(isTrustedOnlyImplKind(kind)).toBe(false),
  );
});

describe('isApiVersionCompatible', () => {
  it('aceita ponto na mesma versão do contrato', () => {
    expect(isApiVersionCompatible('1.0.0', '1.0.0')).toBe(true);
  });

  it('aceita ponto que evoluiu aditivamente', () => {
    expect(isApiVersionCompatible('1.0.0', '1.4.2')).toBe(true);
  });

  it('rejeita ponto que mudou de major', () => {
    expect(isApiVersionCompatible('1.0.0', '2.0.0')).toBe(false);
    expect(isApiVersionCompatible('2.0.0', '1.0.0')).toBe(false);
  });

  it('rejeita contribuição que pede contrato mais novo que o do ponto', () => {
    expect(isApiVersionCompatible('1.5.0', '1.2.0')).toBe(false);
  });

  it('trata 0.x como incompatível entre minors', () => {
    expect(isApiVersionCompatible('0.1.0', '0.2.0')).toBe(false);
    expect(isApiVersionCompatible('0.1.0', '0.1.5')).toBe(true);
  });

  it('rejeita versões malformadas sem lançar', () => {
    expect(isApiVersionCompatible('abc', '1.0.0')).toBe(false);
    expect(isApiVersionCompatible('1.0.0', 'abc')).toBe(false);
  });
});

describe('validateExtensionPoint', () => {
  it('aceita definição bem formada', () => {
    expect(validateExtensionPoint(definition(), 'core.kernel')).toEqual([]);
  });

  it('reporta id inválido', () => {
    const diagnostics = validateExtensionPoint(definition({ id: 'page' }), 'core.kernel');
    expect(diagnostics[0]).toMatchObject({ code: 'extensionPoint.invalid', path: 'extensionPoints[0].id' });
  });

  it('reporta apiVersion ausente ou inválida', () => {
    const diagnostics = validateExtensionPoint(definition({ apiVersion: '1' }), 'core.kernel');
    expect(diagnostics.some((d) => d.path === 'extensionPoints[0].apiVersion')).toBe(true);
  });

  it('reporta título em branco', () => {
    const diagnostics = validateExtensionPoint(definition({ title: '   ' }), 'core.kernel');
    expect(diagnostics.some((d) => d.path === 'extensionPoints[0].title')).toBe(true);
  });

  it('reporta allowedImplKinds ausente', () => {
    const diagnostics = validateExtensionPoint(
      definition({ allowedImplKinds: undefined as unknown as [] }),
      'core.kernel',
    );
    expect(diagnostics.some((d) => d.path === 'extensionPoints[0].allowedImplKinds')).toBe(true);
  });

  it('reporta tipo de implementação inexistente', () => {
    const diagnostics = validateExtensionPoint(
      definition({ allowedImplKinds: ['wasm'] as unknown as [] }),
      'core.kernel',
    );
    expect(diagnostics[0].path).toBe('extensionPoints[0].allowedImplKinds[0]');
  });

  it('reporta ponto que exige implementação sem permitir nenhum tipo', () => {
    const diagnostics = validateExtensionPoint(
      definition({ allowedImplKinds: [], implRequired: true }),
      'core.kernel',
    );
    expect(diagnostics[0].message).toContain('não permite nenhum tipo');
  });

  it('aceita ponto sem implementação e sem tipos permitidos', () => {
    expect(
      validateExtensionPoint(definition({ allowedImplKinds: [], implRequired: false }), 'core.kernel'),
    ).toEqual([]);
  });

  it('usa o índice recebido no caminho do diagnóstico', () => {
    const diagnostics = validateExtensionPoint(definition({ id: 'x' }), 'core.kernel', 2);
    expect(diagnostics[0].path).toBe('extensionPoints[2].id');
  });
});
