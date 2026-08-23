import { describe, it, expect, afterEach } from 'vitest';
import { evaluateFieldBoolean } from '../fieldExpression';
import { UNRESTRICTED_PERMISSION } from './memberPermissions';
import { resetAmbientPermissions, setAmbientPermissions } from './permissionGate';

const evaluate = (expr: string): boolean => evaluateFieldBoolean(expr, { value: null, data: {} });

describe('hasPermission dentro de uma expressão', () => {
  afterEach(() => resetAmbientPermissions());

  it('sem ninguém ter empurrado permissão, a resposta é NÃO', () => {
    expect(evaluate('hasPermission("finance.write")')).toBe(false);
  });

  it('concede o que está no conjunto e recusa o que não está', () => {
    setAmbientPermissions(['finance.read', 'finance.write']);
    expect(evaluate('hasPermission("finance.write")')).toBe(true);
    expect(evaluate('hasPermission("finance.delete")')).toBe(false);
  });

  it('o curinga do dono do escritório concede qualquer permissão', () => {
    setAmbientPermissions([UNRESTRICTED_PERMISSION]);
    expect(evaluate('hasPermission("qualquer.coisa")')).toBe(true);
  });

  it('serve à negação, que é como uma ação se esconde', () => {
    setAmbientPermissions(['medico.read']);
    expect(evaluate('!hasPermission("medico.create")')).toBe(true);
  });

  it('compõe com o resto da expressão', () => {
    setAmbientPermissions(['medico.update']);
    expect(evaluateFieldBoolean('hasPermission("medico.update") and status == "aberto"', {
      value: null,
      data: { status: 'aberto' },
    })).toBe(true);
  });

  it('argumento vazio ou não-texto responde NÃO, sem estourar', () => {
    setAmbientPermissions([UNRESTRICTED_PERMISSION]);
    expect(evaluate('hasPermission("")')).toBe(false);
    expect(evaluate('hasPermission(null)')).toBe(false);
  });

  it('resetar o gate tira o acesso — um caso de teste não vaza para o outro', () => {
    setAmbientPermissions(['finance.write']);
    resetAmbientPermissions();
    expect(evaluate('hasPermission("finance.write")')).toBe(false);
  });
});
