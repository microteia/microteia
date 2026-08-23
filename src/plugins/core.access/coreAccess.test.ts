import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import {
  ACCESS_PERMISSION_POINT,
  ACCESS_RESOURCE_POINT,
  KERNEL_PERMISSIONS,
  PERMISSION_MEMBERS_MANAGE,
  PERMISSION_ROLES_MANAGE,
  buildPermissionCatalog,
  declaredPermissionsOf,
  declaredResourcesOf,
  resolveEffective,
} from '../../domain/schema/access';
import { CORE_PLUGINS } from '../index';

const kernelCatalog = () => {
  const host = createPluginHost();
  host.load(CORE_PLUGINS);
  return buildPermissionCatalog(
    declaredPermissionsOf(host.contributions.query(ACCESS_PERMISSION_POINT)),
    declaredResourcesOf(host.contributions.query(ACCESS_RESOURCE_POINT)),
  );
};

describe('core.access', () => {
  it('publica todas as permissões do núcleo como contribuição', () => {
    expect(kernelCatalog().list).toHaveLength(KERNEL_PERMISSIONS.length);
  });

  it('o catálogo do núcleo fecha sozinho: nenhum ciclo, nenhuma referência quebrada', () => {
    expect(kernelCatalog().diagnostics).toEqual([]);
  });

  it('todo recurso do núcleo tem rótulo, e nenhum aparece como identificador cru', () => {
    const catalog = kernelCatalog();
    for (const permission of catalog.list) {
      expect(catalog.resourceNames.get(permission.resource)).toMatch(/^@core\.access\/resource\./);
    }
  });

  it('gerenciar perfis arrasta gerenciar membros, sem que nenhuma Role diga isso', () => {
    const { effective } = resolveEffective(kernelCatalog(), [PERMISSION_ROLES_MANAGE]);
    expect(effective).toEqual([PERMISSION_MEMBERS_MANAGE, PERMISSION_ROLES_MANAGE]);
  });

  it('não semeia perfil nenhum — perfil é dado do escritório', () => {
    const record = CORE_PLUGINS.find((plugin) => plugin.manifest.id === 'core.access');
    const points = new Set(record?.manifest.contributes?.map((c) => c.point));
    expect([...points].sort()).toEqual([
      ACCESS_PERMISSION_POINT,
      ACCESS_RESOURCE_POINT,
      'i18n.messages',
    ]);
  });
});
