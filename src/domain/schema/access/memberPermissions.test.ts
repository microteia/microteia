import { describe, it, expect } from 'vitest';
import type { AssignedRole } from './memberPermissions';
import {
  UNRESTRICTED_PERMISSION,
  grants,
  grantsAll,
  grantsAny,
  memberPermissions,
} from './memberPermissions';
import { buildPermissionCatalog } from './resolvePermissions';

const catalog = () =>
  buildPermissionCatalog(
    [
      {
        source: 'com.acme.finance',
        permission: { id: 'finance.write', name: 'Edit', requires: ['finance.read', 'person.read'] },
      },
    ],
    [
      { id: 'finance', name: 'Finance', deriveCrud: true },
      { id: 'person', name: 'People', deriveCrud: true },
    ],
  );

const financeiro: AssignedRole = { id: 'r-fin', permissions: ['finance.write'] };
const recepcao: AssignedRole = { id: 'r-rec', permissions: ['person.create'] };
const vazio: AssignedRole = { id: 'r-vazio', permissions: [] };
const roles = [financeiro, recepcao, vazio];

describe('memberPermissions', () => {
  it('usuário com UM perfil recebe o fecho dele', () => {
    const { explicit, effective } = memberPermissions(catalog(), roles, ['r-fin']);
    expect(explicit).toEqual(['finance.write']);
    expect(effective).toEqual(['finance.read', 'finance.write', 'person.read']);
  });

  it('usuário com MÚLTIPLOS perfis recebe a união, sem repetição', () => {
    const { effective } = memberPermissions(catalog(), roles, ['r-fin', 'r-rec']);
    expect(effective).toEqual(['finance.read', 'finance.write', 'person.create', 'person.read']);
  });

  it('perfil sem permissão nenhuma não concede nada', () => {
    expect(memberPermissions(catalog(), roles, ['r-vazio']).effective).toEqual([]);
  });

  it('usuário sem perfil nenhum não recebe nada', () => {
    expect(memberPermissions(catalog(), roles, []).effective).toEqual([]);
  });

  it('perfil de OUTRO escritório não concede nada — ele não está na lista deste', () => {
    expect(memberPermissions(catalog(), roles, ['r-de-outro-tenant']).effective).toEqual([]);
  });

  it('quem PERDE um perfil perde o que só ele dava', () => {
    const antes = memberPermissions(catalog(), roles, ['r-fin', 'r-rec']).effective;
    const depois = memberPermissions(catalog(), roles, ['r-rec']).effective;
    expect(antes).toContain('finance.write');
    expect(depois).not.toContain('finance.write');
    expect(depois).toContain('person.create');
  });

  it('quem RECEBE um perfil ganha o fecho dele, sem tocar no que já tinha', () => {
    const depois = memberPermissions(catalog(), roles, ['r-rec', 'r-fin']).effective;
    expect(depois).toContain('person.create');
    expect(depois).toContain('finance.read');
  });
});

describe('grants / grantsAny / grantsAll', () => {
  const granted = ['finance.read', 'finance.write'];

  it('concede o que está na lista e recusa o que não está', () => {
    expect(grants(granted, 'finance.read')).toBe(true);
    expect(grants(granted, 'person.delete')).toBe(false);
  });

  it('grantsAny basta uma', () => {
    expect(grantsAny(granted, ['person.delete', 'finance.read'])).toBe(true);
    expect(grantsAny(granted, ['person.delete'])).toBe(false);
    expect(grantsAny(granted, [])).toBe(false);
  });

  it('grantsAll exige todas', () => {
    expect(grantsAll(granted, ['finance.read', 'finance.write'])).toBe(true);
    expect(grantsAll(granted, ['finance.read', 'person.read'])).toBe(false);
    expect(grantsAll(granted, [])).toBe(true);
  });

  it('o curinga do dono do escritório concede tudo, inclusive o que não existe', () => {
    const owner = [UNRESTRICTED_PERMISSION];
    expect(grants(owner, 'qualquer.coisa')).toBe(true);
    expect(grantsAll(owner, ['a.read', 'b.write'])).toBe(true);
    expect(grantsAny(owner, [])).toBe(true);
  });
});
