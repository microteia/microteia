import { describe, it, expect } from 'vitest';
import type { AccessPermission } from './permission';
import type { DeclaredPermission, PermissionResource } from './resolvePermissions';
import { buildPermissionCatalog, dependenciesOf, resolveEffective } from './resolvePermissions';

const declare = (source: string, ...permissions: AccessPermission[]): DeclaredPermission[] =>
  permissions.map((permission) => ({ permission, source }));

const screens: PermissionResource[] = [
  { id: 'finance', name: 'Finance', deriveCrud: true, source: 'com.acme.finance' },
  { id: 'person', name: 'People', deriveCrud: true, source: 'com.acme.people' },
];

const financeCatalog = () =>
  buildPermissionCatalog(
    declare(
      'com.acme.finance',
      { id: 'finance.read', name: 'View finance' },
      { id: 'finance.write', name: 'Edit finance', requires: ['finance.read', 'person.read'] },
      { id: 'finance.delete', name: 'Delete finance', requires: ['finance.write'] },
    ),
    screens,
  );

describe('buildPermissionCatalog', () => {
  it('deriva as quatro ações de cada tela declarada', () => {
    const catalog = buildPermissionCatalog([], [{ id: 'medico', name: 'Doctors', deriveCrud: true }]);
    expect(catalog.list.map((p) => p.id)).toEqual([
      'medico.read',
      'medico.create',
      'medico.update',
      'medico.delete',
    ]);
    expect(catalog.list.every((p) => p.derived)).toBe(true);
  });

  it('criar, editar e excluir dependem de VER — ninguém grava no que não pode ler', () => {
    const catalog = buildPermissionCatalog([], [{ id: 'medico', name: 'Doctors', deriveCrud: true }]);
    expect(catalog.byId.get('medico.read')?.requires).toEqual([]);
    for (const action of ['create', 'update', 'delete']) {
      expect(catalog.byId.get(`medico.${action}`)?.requires).toEqual(['medico.read']);
    }
  });

  it('marcar só "criar" concede ver junto', () => {
    const catalog = buildPermissionCatalog([], [{ id: 'medico', name: 'Doctors', deriveCrud: true }]);
    expect(resolveEffective(catalog, ['medico.create']).effective).toEqual([
      'medico.create',
      'medico.read',
    ]);
  });

  it('a declaração explícita sobrepõe a derivada de mesmo id, trazendo as dependências', () => {
    const catalog = financeCatalog();
    const write = catalog.byId.get('finance.write');
    expect(write).toMatchObject({
      name: 'Edit finance',
      derived: false,
      source: 'com.acme.finance',
      requires: ['finance.read', 'person.read'],
    });
  });

  it('a tela sem declaração continua com as quatro derivadas', () => {
    const catalog = financeCatalog();
    expect(catalog.byId.get('person.create')?.derived).toBe(true);
    expect(catalog.byId.get('finance.create')?.derived).toBe(true);
  });

  it('guarda o nome do recurso para a tela agrupar sem repetir o rótulo', () => {
    expect(financeCatalog().resourceNames.get('finance')).toBe('Finance');
  });

  it('recurso que não é coleção dá nome ao grupo sem derivar CRUD nenhum', () => {
    const catalog = buildPermissionCatalog(
      declare('core.access', { id: 'roles.manage', name: 'Manage roles' }),
      [{ id: 'roles', name: '@core.access/resource.roles' }],
    );
    expect(catalog.list.map((p) => p.id)).toEqual(['roles.manage']);
    expect(catalog.resourceNames.get('roles')).toBe('@core.access/resource.roles');
  });

  it('sem rótulo declarado, o recurso fica com o próprio identificador', () => {
    const catalog = buildPermissionCatalog(
      declare('com.acme.x', { id: 'orfao.use', name: 'Use' }),
      [],
    );
    expect(catalog.resourceNames.get('orfao')).toBe('orfao');
  });

  it('ordena por recurso e pela ordem canônica das ações, nunca pela de carregamento', () => {
    const catalog = buildPermissionCatalog(
      declare('com.acme.x', { id: 'zebra.use', name: 'Use' }),
      [{ id: 'alpha', name: 'Alpha', deriveCrud: true }],
    );
    expect(catalog.list.map((p) => p.id)).toEqual([
      'alpha.read',
      'alpha.create',
      'alpha.update',
      'alpha.delete',
      'zebra.use',
    ]);
  });

  it('recusa a permissão declarada duas vezes, mantendo a primeira', () => {
    const catalog = buildPermissionCatalog(
      [
        ...declare('com.acme.a', { id: 'finance.write', name: 'A' }),
        ...declare('com.acme.b', { id: 'finance.write', name: 'B' }),
      ],
      [],
    );
    expect(catalog.byId.get('finance.write')?.name).toBe('A');
    expect(catalog.diagnostics.map((d) => d.code)).toContain('access.permission.duplicate');
  });

  it('recusa a declaração malformada sem derrubar o resto do catálogo', () => {
    const catalog = buildPermissionCatalog(
      declare(
        'com.acme.x',
        { id: 'quebrada', name: 'Broken' },
        { id: 'ok.read', name: 'Fine' },
      ),
      [],
    );
    expect(catalog.byId.has('ok.read')).toBe(true);
    expect(catalog.diagnostics[0].code).toBe('access.permission.invalid');
  });

  it('acusa dependência inexistente já na montagem do catálogo', () => {
    const catalog = buildPermissionCatalog(
      declare('com.acme.x', { id: 'a.write', name: 'A', requires: ['b.read'] }),
      [],
    );
    expect(catalog.diagnostics.map((d) => d.code)).toContain('access.permission.unknown');
  });

  it('acusa ciclo já na montagem do catálogo, dizendo o caminho', () => {
    const catalog = buildPermissionCatalog(
      declare(
        'com.acme.x',
        { id: 'a.use', name: 'A', requires: ['b.use'] },
        { id: 'b.use', name: 'B', requires: ['c.use'] },
        { id: 'c.use', name: 'C', requires: ['a.use'] },
      ),
      [],
    );
    const cycle = catalog.diagnostics.find((d) => d.code === 'access.permission.cycle');
    expect(cycle?.messageParams?.path).toBe('a.use → b.use → c.use → a.use');
  });
});

describe('resolveEffective', () => {
  it('permissão direta, sem dependência, resolve nela mesma', () => {
    const { effective } = resolveEffective(financeCatalog(), ['finance.read']);
    expect(effective).toEqual(['finance.read']);
  });

  it('resolve uma dependência', () => {
    const catalog = buildPermissionCatalog(
      declare('com.acme.x', { id: 'a.write', name: 'A', requires: ['a.read'] }),
      [{ id: 'a', name: 'A', deriveCrud: true }],
    );
    expect(resolveEffective(catalog, ['a.write']).effective).toEqual(['a.read', 'a.write']);
  });

  it('resolve múltiplas dependências de uma vez', () => {
    const { effective } = resolveEffective(financeCatalog(), ['finance.write']);
    expect(effective).toEqual(['finance.read', 'finance.write', 'person.read']);
  });

  it('resolve dependência transitiva', () => {
    const { effective } = resolveEffective(financeCatalog(), ['finance.delete']);
    expect(effective).toEqual([
      'finance.delete',
      'finance.read',
      'finance.write',
      'person.read',
    ]);
  });

  it('dependência compartilhada aparece uma única vez', () => {
    const catalog = buildPermissionCatalog(
      declare(
        'com.acme.x',
        { id: 'a.write', name: 'A', requires: ['shared.read'] },
        { id: 'b.write', name: 'B', requires: ['shared.read'] },
        { id: 'shared.read', name: 'Shared' },
      ),
      [],
    );
    expect(resolveEffective(catalog, ['a.write', 'b.write']).effective).toEqual([
      'a.write',
      'b.write',
      'shared.read',
    ]);
  });

  it('conjunto explícito vazio resolve em nada', () => {
    expect(resolveEffective(financeCatalog(), []).effective).toEqual([]);
  });

  it('permissão inexistente é recusada, e não silenciosamente concedida', () => {
    const { effective, diagnostics } = resolveEffective(financeCatalog(), ['fantasma.read']);
    expect(effective).toEqual([]);
    expect(diagnostics[0].code).toBe('access.permission.unknown');
  });

  it('ciclo NÃO concede nada — falha fechada', () => {
    const catalog = buildPermissionCatalog(
      declare(
        'com.acme.x',
        { id: 'a.use', name: 'A', requires: ['b.use'] },
        { id: 'b.use', name: 'B', requires: ['a.use'] },
      ),
      [],
    );
    const { effective, diagnostics } = resolveEffective(catalog, ['a.use']);
    expect(effective).toEqual([]);
    expect(diagnostics.some((d) => d.code === 'access.permission.cycle')).toBe(true);
  });

  it('dependência quebrada NÃO concede a permissão que a exige, mas não afeta as demais', () => {
    const catalog = buildPermissionCatalog(
      declare(
        'com.acme.x',
        { id: 'a.write', name: 'A', requires: ['sumiu.read'] },
        { id: 'b.read', name: 'B' },
      ),
      [],
    );
    expect(resolveEffective(catalog, ['a.write', 'b.read']).effective).toEqual(['b.read']);
  });

  it('mudar a dependência muda as efetivas sem tocar na Role', () => {
    const explicit = ['finance.write'];
    const antes = resolveEffective(financeCatalog(), explicit).effective;

    const depois = resolveEffective(
      buildPermissionCatalog(
        declare(
          'com.acme.finance',
          { id: 'finance.read', name: 'View finance' },
          {
            id: 'finance.write',
            name: 'Edit finance',
            requires: ['finance.read', 'person.read', 'company.read'],
          },
          { id: 'company.read', name: 'View companies' },
        ),
        screens,
      ),
      explicit,
    ).effective;

    expect(antes).not.toContain('company.read');
    expect(depois).toContain('company.read');
  });
});

describe('dependenciesOf', () => {
  it('lista o que a permissão arrasta consigo, sem ela própria', () => {
    expect(dependenciesOf(financeCatalog(), 'finance.delete')).toEqual([
      'finance.read',
      'finance.write',
      'person.read',
    ]);
  });

  it('devolve vazio para a permissão que não resolve', () => {
    const catalog = buildPermissionCatalog(
      declare('com.acme.x', { id: 'a.use', name: 'A', requires: ['sumiu.read'] }),
      [],
    );
    expect(dependenciesOf(catalog, 'a.use')).toEqual([]);
  });
});
