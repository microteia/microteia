import { describe, expect, it } from 'vitest';
import type { AccessPermission } from './permission';
import type { DeclaredPermission, PermissionResource } from './resolvePermissions';
import { buildPermissionCatalog } from './resolvePermissions';
import { requiredBySelection, withDependencies } from './permissionSelection';

const declare = (source: string, ...permissions: AccessPermission[]): DeclaredPermission[] =>
  permissions.map((permission) => ({ permission, source }));

const screens: PermissionResource[] = [
  { id: 'prazos', name: 'Deadlines', deriveCrud: true, source: 'com.acme.deadlines' },
  { id: 'pessoas', name: 'People', deriveCrud: true, source: 'com.acme.people' },
];

// As derivadas já trazem `requires: [<recurso>.read]` para create/update/delete — é o que a tela
// mostra como "inclui automaticamente". A declarada abaixo atravessa RECURSO de propósito.
const catalog = () =>
  buildPermissionCatalog(
    declare(
      'com.acme.finance',
      { id: 'financeiro.read', name: 'View finance' },
      { id: 'financeiro.create', name: 'Create finance', requires: ['financeiro.read', 'pessoas.read'] },
    ),
    screens,
  );

describe('withDependencies', () => {
  it('marcar criar traz visualizar junto', () => {
    expect(withDependencies(catalog(), ['prazos.create'])).toEqual(['prazos.create', 'prazos.read']);
  });

  // O fecho não para na borda do grupo: a tela agrupa por recurso, a dependência não.
  it('atravessa o recurso quando a dependência mora noutro grupo', () => {
    expect(withDependencies(catalog(), ['financeiro.create']))
      .toEqual(['financeiro.create', 'financeiro.read', 'pessoas.read']);
  });

  it('não duplica o que já estava selecionado', () => {
    expect(withDependencies(catalog(), ['prazos.create', 'prazos.read']))
      .toEqual(['prazos.create', 'prazos.read']);
  });

  it('seleção vazia continua vazia', () => {
    expect(withDependencies(catalog(), [])).toEqual([]);
  });

  // Descartá-lo aqui esconderia um erro de digitação que a emissão recusa com o nome do id.
  it('deixa passar o id que não está no catálogo, em vez de engoli-lo', () => {
    expect(withDependencies(catalog(), ['nao.existe'])).toEqual(['nao.existe']);
  });
});

describe('requiredBySelection', () => {
  it('diz quem na seleção exige cada permissão', () => {
    const required = requiredBySelection(catalog(), ['prazos.create', 'prazos.update']);
    expect(required.get('prazos.read')).toEqual(['prazos.create', 'prazos.update']);
  });

  // É esta linha que a tela usa para avisar num item DESMARCADO que algo selecionado o exigia — o
  // teto estreito continua possível, e deixa de ser possível por engano.
  it('a exigida continua listada mesmo que não esteja selecionada', () => {
    const required = requiredBySelection(catalog(), ['prazos.create']);
    expect(required.has('prazos.read')).toBe(true);
  });

  it('não lista a exigente como exigida', () => {
    const required = requiredBySelection(catalog(), ['prazos.create']);
    expect(required.has('prazos.create')).toBe(false);
  });

  it('seleção sem dependência nenhuma devolve mapa vazio', () => {
    expect(requiredBySelection(catalog(), ['prazos.read']).size).toBe(0);
  });
});
