import { describe, it, expect } from 'vitest';
import {
  collectionPermissionId,
  isValidAccessPermissionId,
  parseAccessPermission,
  validateAccessPermission,
} from './permission';

describe('parseAccessPermission', () => {
  it('separa recurso e ação', () => {
    expect(parseAccessPermission('finance.write')).toEqual({ resource: 'finance', action: 'write' });
  });

  it('aceita o nome de coleção como recurso, com maiúscula e sublinhado', () => {
    expect(parseAccessPermission('minhaTela_2.read')).toEqual({
      resource: 'minhaTela_2',
      action: 'read',
    });
  });

  it.each(['finance', 'finance.', '.read', 'finance.read.extra', 'finance.Read', '', '1x.read'])(
    'recusa "%s"',
    (id) => {
      expect(parseAccessPermission(id)).toBeNull();
      expect(isValidAccessPermissionId(id)).toBe(false);
    },
  );

  it('recusa entrada não-string sem lançar', () => {
    expect(parseAccessPermission(null as unknown as string)).toBeNull();
  });
});

describe('collectionPermissionId', () => {
  it('monta o id derivado da coleção', () => {
    expect(collectionPermissionId('finance', 'delete')).toBe('finance.delete');
  });
});

describe('validateAccessPermission', () => {
  const valid = { id: 'finance.write', name: 'Edit finance' };

  it('aceita a declaração mínima', () => {
    expect(validateAccessPermission(valid)).toEqual([]);
  });

  it('recusa id malformado', () => {
    const [diagnostic] = validateAccessPermission({ ...valid, id: 'finance' });
    expect(diagnostic.code).toBe('access.permission.invalid');
    expect(diagnostic.path).toBe('id');
  });

  it('recusa nome vazio', () => {
    const [diagnostic] = validateAccessPermission({ ...valid, name: '   ' });
    expect(diagnostic.path).toBe('name');
  });

  it('recusa dependência de si mesma', () => {
    const [diagnostic] = validateAccessPermission({ ...valid, requires: ['finance.write'] });
    expect(diagnostic.message).toContain('requires.self');
  });

  it('recusa dependência malformada, apontando o índice', () => {
    const [diagnostic] = validateAccessPermission({ ...valid, requires: ['finance.read', 'nope'] });
    expect(diagnostic.path).toBe('requires[1]');
  });

  it('recusa `requires` que não é lista, sem lançar', () => {
    const diagnostics = validateAccessPermission({
      ...valid,
      requires: 'finance.read' as unknown as string[],
    });
    expect(diagnostics).toHaveLength(1);
  });

  it('carimba o plugin de origem no diagnóstico', () => {
    const [diagnostic] = validateAccessPermission({ ...valid, id: 'x' }, { pluginId: 'com.acme.x' });
    expect(diagnostic.pluginId).toBe('com.acme.x');
  });
});
