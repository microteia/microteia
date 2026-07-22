import { describe, it, expect } from 'vitest';
import { error, errorsOf, hasErrors, warning, withPlugin } from './diagnostics';

describe('error / warning', () => {
  it('marca a severidade e preserva os demais campos', () => {
    expect(error({ code: 'manifest.invalid', message: 'x', pluginId: 'com.acme.x' })).toEqual({
      severity: 'error',
      code: 'manifest.invalid',
      message: 'x',
      pluginId: 'com.acme.x',
    });
    expect(warning({ code: 'manifest.invalid', message: 'x' })).toMatchObject({ severity: 'warning' });
  });
});

describe('hasErrors', () => {
  it('é falso para lista vazia', () => {
    expect(hasErrors([])).toBe(false);
  });

  it('é falso quando só há avisos', () => {
    expect(hasErrors([warning({ code: 'manifest.invalid', message: 'x' })])).toBe(false);
  });

  it('é verdadeiro com ao menos um erro', () => {
    expect(
      hasErrors([warning({ code: 'manifest.invalid', message: 'x' }), error({ code: 'manifest.invalid', message: 'y' })]),
    ).toBe(true);
  });
});

describe('errorsOf', () => {
  it('filtra somente os erros', () => {
    const diagnostics = [
      warning({ code: 'manifest.invalid', message: 'aviso' }),
      error({ code: 'manifest.invalid', message: 'erro' }),
    ];
    expect(errorsOf(diagnostics)).toHaveLength(1);
    expect(errorsOf(diagnostics)[0].message).toBe('erro');
  });
});

describe('withPlugin', () => {
  it('carimba o pluginId em quem não tem', () => {
    const result = withPlugin('com.acme.x', [error({ code: 'manifest.invalid', message: 'a' })]);
    expect(result[0].pluginId).toBe('com.acme.x');
  });

  it('preserva o pluginId já preenchido', () => {
    const result = withPlugin('com.acme.x', [
      error({ code: 'manifest.invalid', message: 'a', pluginId: 'com.other.y' }),
    ]);
    expect(result[0].pluginId).toBe('com.other.y');
  });

  it('não muta a lista original', () => {
    const original = [error({ code: 'manifest.invalid', message: 'a' })];
    withPlugin('com.acme.x', original);
    expect(original[0].pluginId).toBeUndefined();
  });
});
