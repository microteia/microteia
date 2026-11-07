import { describe, expect, it } from 'vitest';
import { KERNEL_VERSION } from '../../schema/plugin/kernelVersion';
import type { IInstalledCatalogSourceRepository } from '../../repositories/IInstalledCatalogSourceRepository';
import { makeExportInstalledCatalogUseCase } from './ExportInstalledCatalogUseCase';
import { INSTALLED_CATALOG_VERSION, serializeInstalledCatalog } from './installedCatalogSnapshot';

/**
 * O retrato tirado pela APLICAÇÃO — a porta de quem administra o escritório sem papel no projeto
 * Firebase. O que se prova: os documentos chegam crus, e saem como o mesmo arquivo que o Console
 * escreveria, anunciando quem o tirou e por qual kernel.
 */
const repository: IInstalledCatalogSourceRepository = {
  read: async () => ({
    projectId: 'office-prod',
    screens: [
      {
        id: 'customers',
        data: {
          titleSingular: 'Customer',
          titleFieldKey: 'name',
          enabled: true,
          fields: [{ key: 'name', label: 'Nome', type: 'text', required: true, order: 0, placeholder: 'Digite' }],
        },
      },
      { id: 'archived', data: { titleSingular: 'Archived', titleFieldKey: 'name', enabled: false, fields: [] } },
    ],
    lookups: [{ id: 'customerSegments', data: { label: 'Segmentos', options: [{ key: 'gold', label: 'Ouro' }] } }],
    tagLists: [],
    extensions: [
      {
        id: 'com.example.billing',
        data: {
          active: false,
          package: {
            manifest: { id: 'com.example.billing', name: 'Billing', version: '2.1.0', exports: ['notify'] },
            workflows: [{ templateId: 'notify', name: 'Notify', steps: [{ type: 'secret-step' }] }],
          },
        },
      },
    ],
  }),
};

const EXPORTED_AT = new Date('2026-11-06T10:00:00.000Z');

describe('o catálogo exportado pela aplicação', () => {
  const run = () => makeExportInstalledCatalogUseCase(repository)
    .execute({ id: 'tenant-1', name: 'Escritório Central' }, EXPORTED_AT);

  it('se anuncia como retrato da aplicação, com o kernel que está rodando', async () => {
    const snapshot = await run();
    expect(snapshot.version).toBe(INSTALLED_CATALOG_VERSION);
    expect(snapshot.projectId).toBe('office-prod');
    expect(snapshot.tenantId).toBe('tenant-1');
    expect(snapshot.tenantName).toBe('Escritório Central');
    expect(snapshot.exportedAt).toBe(EXPORTED_AT.toISOString());
    expect(snapshot.kernelVersion).toBe(KERNEL_VERSION);
    expect(snapshot.exportedBy).toBe('application');
    expect('consoleVersion' in snapshot).toBe(false);
  });

  it('lê a cópia instalada de dentro de `package`, como o kernel, e mantém a desativada', async () => {
    const snapshot = await run();
    expect(snapshot.extensions).toStrictEqual([{
      id: 'com.example.billing',
      name: 'Billing',
      version: '2.1.0',
      active: false,
      exports: [{ id: 'notify', kind: 'workflow', name: 'Notify' }],
      navGroups: [],
      documentTemplates: [],
      fieldPresets: [],
    }]);
  });

  it('leva o esquema e nunca o conteúdo: sem tela desligada, opção de lista, placeholder ou passo', async () => {
    const snapshot = await run();
    const written = serializeInstalledCatalog(snapshot);
    expect(snapshot.screens.map((one) => one.key)).toStrictEqual(['customers']);
    expect(written).not.toContain('Ouro');
    expect(written).not.toContain('Digite');
    expect(written).not.toContain('secret-step');
  });
});
