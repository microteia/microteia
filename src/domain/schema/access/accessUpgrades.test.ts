import { describe, it, expect } from 'vitest';
import { buildPermissionCatalog } from './resolvePermissions';
import { KERNEL_PERMISSIONS, KERNEL_PERMISSION_RESOURCES, PERMISSION_RECORD_IMPORT_RUN } from './kernelPermissions';
import { ACCESS_UPGRADES, pendingAccessUpgrades, upgradeRolePermissions } from './accessUpgrades';

const catalogo = () => buildPermissionCatalog(
  KERNEL_PERMISSIONS.map((permission) => ({ permission, source: 'core.access' })),
  [
    ...KERNEL_PERMISSION_RESOURCES,
    { id: 'precos', name: 'Preços', deriveCrud: true, deriveImport: true },
    { id: 'estoque', name: 'Estoque', deriveCrud: true, deriveImport: true },
    { id: 'notas', name: 'Notas', deriveCrud: true },
  ],
);

describe('atualizações de acesso pendentes', () => {
  it('o escritório sem marca nenhuma — todo escritório de antes — tem todas pendentes', () => {
    expect(pendingAccessUpgrades(undefined)).toEqual([...ACCESS_UPGRADES]);
    expect(pendingAccessUpgrades('import-per-screen')).toEqual([...ACCESS_UPGRADES]);
  });

  it('o que o escritório já recebeu não volta, e id desconhecido não atrapalha', () => {
    expect(pendingAccessUpgrades([...ACCESS_UPGRADES, 'de-outra-versao', 7])).toEqual([]);
  });
});

describe('import-per-screen (#29): quem importava continua importando onde importava', () => {
  it('o perfil com `record-import.run` recebe `<coleção>.import` onde cria ou altera e a tela importa', () => {
    const next = upgradeRolePermissions(
      ['import-per-screen'],
      catalogo(),
      [PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'estoque.update', 'notas.create'],
    );
    expect(next).toEqual([
      PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'estoque.update', 'notas.create',
      'estoque.import', 'precos.import',
    ]);
  });

  it('só ver a coleção não basta: a importação nunca gravaria ali', () => {
    expect(upgradeRolePermissions(['import-per-screen'], catalogo(), [PERMISSION_RECORD_IMPORT_RUN, 'precos.read']))
      .toBeNull();
  });

  it('sem `record-import.run` o perfil não importava, e não ganha nada', () => {
    expect(upgradeRolePermissions(['import-per-screen'], catalogo(), ['precos.create', 'estoque.update'])).toBeNull();
  });

  it('o perfil que já tem a permissão da tela não muda', () => {
    expect(upgradeRolePermissions(
      ['import-per-screen'],
      catalogo(),
      [PERMISSION_RECORD_IMPORT_RUN, 'precos.create', 'precos.import'],
    )).toBeNull();
  });

  it('sem atualização pendente, nada muda — mesmo o perfil que ganharia', () => {
    expect(upgradeRolePermissions([], catalogo(), [PERMISSION_RECORD_IMPORT_RUN, 'precos.create'])).toBeNull();
  });
});
