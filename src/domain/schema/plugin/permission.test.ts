import { describe, it, expect } from 'vitest';
import {
  isPermitted,
  isValidPermission,
  parsePermission,
  permissionCovers,
  validatePermissions,
} from './permission';

describe('parsePermission', () => {
  it('lê a forma completa dominio:recurso:acao', () => {
    expect(parsePermission('data:cases:read')).toMatchObject({
      domain: 'data',
      resource: 'cases',
      action: 'read',
    });
  });

  it('lê a forma curta com recurso implícito', () => {
    expect(parsePermission('workflow:run')).toMatchObject({
      domain: 'workflow',
      resource: '*',
      action: 'run',
    });
  });

  it('aceita recurso com ponto (id de capability)', () => {
    expect(parsePermission('capability:ai.completion:use')).toMatchObject({
      resource: 'ai.completion',
      action: 'use',
    });
  });

  it('aceita curinga em recurso e ação', () => {
    expect(parsePermission('data:*:read')).toMatchObject({ resource: '*', action: 'read' });
    expect(parsePermission('data:cases:*')).toMatchObject({ resource: 'cases', action: '*' });
  });

  it.each([
    'data',
    'data:cases:read:extra',
    'unknown:cases:read',
    'data::read',
    'DATA:cases:read',
    'data:Cases:read',
    '',
  ])('rejeita "%s"', (raw) => {
    expect(parsePermission(raw)).toBeNull();
    expect(isValidPermission(raw)).toBe(false);
  });

  it('rejeita entrada não-string sem lançar', () => {
    expect(parsePermission(null as unknown as string)).toBeNull();
  });
});

describe('permissionCovers', () => {
  it('cobre a permissão idêntica', () => {
    expect(permissionCovers('data:cases:read', 'data:cases:read')).toBe(true);
  });

  it('não cobre domínio diferente', () => {
    expect(permissionCovers('workflow:cases:read', 'data:cases:read')).toBe(false);
  });

  it('curinga de recurso cobre qualquer recurso', () => {
    expect(permissionCovers('data:*:read', 'data:cases:read')).toBe(true);
    expect(permissionCovers('data:*:read', 'data:persons:read')).toBe(true);
  });

  it('curinga de ação cobre qualquer ação', () => {
    expect(permissionCovers('data:cases:*', 'data:cases:delete')).toBe(true);
  });

  it('permissão específica NÃO cobre o curinga exigido', () => {
    expect(permissionCovers('data:cases:read', 'data:*:read')).toBe(false);
    expect(permissionCovers('data:cases:read', 'data:cases:*')).toBe(false);
  });

  it('não cobre ação diferente', () => {
    expect(permissionCovers('data:cases:read', 'data:cases:write')).toBe(false);
  });

  it('retorna false quando qualquer lado é inválido', () => {
    expect(permissionCovers('lixo', 'data:cases:read')).toBe(false);
    expect(permissionCovers('data:cases:read', 'lixo')).toBe(false);
  });
});

describe('isPermitted', () => {
  it('basta uma permissão concedida cobrir a exigida', () => {
    expect(isPermitted(['ui:notify', 'data:*:read'], 'data:cases:read')).toBe(true);
  });

  it('nega quando nenhuma cobre', () => {
    expect(isPermitted(['data:cases:read'], 'data:cases:write')).toBe(false);
  });

  it('nega com lista vazia', () => {
    expect(isPermitted([], 'data:cases:read')).toBe(false);
  });
});

describe('validatePermissions', () => {
  it('não reclama de lista ausente', () => {
    expect(validatePermissions(undefined, 'com.acme.x')).toEqual([]);
  });

  it('não reclama de permissões válidas', () => {
    expect(validatePermissions(['data:cases:read', 'workflow:run'], 'com.acme.x')).toEqual([]);
  });

  it('reporta cada permissão inválida com o índice', () => {
    const diagnostics = validatePermissions(['data:cases:read', 'lixo'], 'com.acme.x');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'permission.invalid',
      pluginId: 'com.acme.x',
      path: 'permissions[1]',
    });
  });
});
