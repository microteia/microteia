import { describe, expect, it } from 'vitest';
import {
  artifactAccessOf,
  artifactPermissionResources,
  reportViewPermissionId,
  workflowRunPermissionId,
  workflowRunPermissions,
} from './artifactAccess';
import { buildPermissionCatalog, resolveEffective } from './resolvePermissions';
import { KERNEL_PERMISSIONS, KERNEL_PERMISSION_RESOURCES } from './kernelPermissions';

const catalogWith = (resources: ReturnType<typeof artifactPermissionResources>) => buildPermissionCatalog(
  KERNEL_PERMISSIONS.map((permission) => ({ permission, source: 'core.access' })),
  [...KERNEL_PERMISSION_RESOURCES, ...resources],
);

describe('artifactAccess — a porta gera a própria permissão (#33)', () => {
  it('o id sai do sourceId quando há, para sobreviver a reinstalar a extensão, e nunca do nome', () => {
    expect(workflowRunPermissionId({ id: 'k3F9', sourceId: 'abc-123' })).toBe('workflow-abc-123.run');
    expect(workflowRunPermissionId({ id: 'k3F9' })).toBe('workflow-k3F9.run');
    expect(workflowRunPermissionId({ id: 'k3F9', sourceId: 'com.acme/x' })).toBe('workflow-k3F9.run');
    expect(reportViewPermissionId({ id: 'r1' })).toBe('report-r1.view');
  });

  it('executar exige sempre automation.run; a restrição e a permissão escolhida só somam', () => {
    expect(workflowRunPermissions({ id: 'w' })).toEqual(['automation.run']);
    expect(workflowRunPermissions({ id: 'w', access: { restricted: true } })).toEqual(['automation.run', 'workflow-w.run']);
    expect(workflowRunPermissions({ id: 'w', access: { permission: 'finance.update' } })).toEqual(['automation.run', 'finance.update']);
  });

  it('uma permissão escolhida inválida não trava a porta nem a abre: é ignorada', () => {
    expect(workflowRunPermissions({ id: 'w', access: { permission: 'not a permission' } })).toEqual(['automation.run']);
  });

  it('lê do documento só o que tem a forma certa', () => {
    expect(artifactAccessOf({ restricted: true, extra: 1 })).toEqual({ restricted: true });
    expect(artifactAccessOf({ restricted: 'yes' })).toBeNull();
    expect(artifactAccessOf({ permission: '  finance.update ' })).toEqual({ permission: 'finance.update' });
    expect(artifactAccessOf(null)).toBeNull();
  });

  it('no catálogo, Executar arrasta automation.run e aparece agrupado pela porta, com o nome dela', () => {
    const catalog = catalogWith(artifactPermissionResources(
      [{ id: 'w', name: 'Adjust salary', access: { restricted: true } }, { id: 'free', name: 'Issue receipt' }],
      [{ id: 'r', title: 'Payroll', restricted: true }],
    ));
    expect(catalog.byId.get('workflow-w.run')?.requires).toEqual(['automation.run']);
    expect(catalog.byId.has('workflow-free.run')).toBe(false);
    expect(catalog.byId.get('report-r.view')?.requires).toEqual([]);
    expect(catalog.resourceLabels.get('report-r')).toEqual({ name: '@core.access/resource.report', nameParams: { name: 'Payroll' } });
    expect(resolveEffective(catalog, ['workflow-w.run']).effective).toEqual(['automation.run', 'workflow-w.run']);
  });

  it('o perfil que guardou a permissão de uma porta que deixou de existir continua válido', () => {
    const resolved = resolveEffective(catalogWith([]), ['workflow-gone.run', 'automation.run']);
    expect(resolved.effective).toEqual(['automation.run']);
  });
});
