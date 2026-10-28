import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../domain/entities/MarketplacePlugin';
import type { OfferedFieldPreset } from '../../domain/usecases/plugins/fieldPresetRefs';
import { declaredFieldPresets } from '../../domain/usecases/plugins/fieldPresetRefs';
import { brasilPlugin } from '../../plugins/marketplace/brasil';
import { fieldPresetFindings, fieldPresetReport } from './fieldPresets';
import type { WorkspaceCatalog } from './workspaceCatalog';

const BRASIL = brasilPlugin.manifest.id;
const BRASIL_PRESETS = declaredFieldPresets(brasilPlugin.manifest.contributes);

const masked = (key: string, mask: string): TemplateField =>
  ({ key, label: key, type: 'masked', mask, order: 0, required: false }) as TemplateField;

const dte = (mask: string, dependencies: Record<string, string> = { [BRASIL]: '^1.2.0' }): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.dte-cad', version: '0.1.0', kernel: '^2.80.0', name: 'DTE', dependencies },
  workflows: [],
  screens: [{
    key: 'contribuintes', titleSingular: 'Contribuinte', titlePlural: 'Contribuintes', icon: 'person',
    titleFieldKey: 'documento', fields: [masked('documento', mask)],
  }],
});

const leitura = (
  authored: { pluginId: string; fieldPresets?: OfferedFieldPreset[] }[],
  extensions: { id: string; fieldPresets?: OfferedFieldPreset[] }[] | null,
): WorkspaceCatalog => ({
  authored,
  installed: extensions === null ? null : { tenantId: 't1', tenantName: 'Escritório', ageDays: 3, extensions },
}) as unknown as WorkspaceCatalog;

describe('o preset de OUTRA extensão, no check', () => {
  it('recusa a chave que a dependência instalada não tem, diz de onde leu e sugere a grafia certa', () => {
    const [achado] = fieldPresetFindings(dte('cpf-cnpj'), leitura([], [{ id: BRASIL, fieldPresets: BRASIL_PRESETS }]));
    expect(achado).toMatchObject({ preset: 'cpf-cnpj', field: 'contribuintes.documento', path: 'mask', status: 'refused' });
    expect(achado.detail).toContain('"cpfCnpj"');
    expect(achado.detail).toContain('installed-catalog.json');
  });

  it('confere pela irmã escrita no mesmo diretório, que vence o retrato', () => {
    const read = leitura(
      [{ pluginId: BRASIL, fieldPresets: [{ key: 'cpf-cnpj', slots: ['mask'] }] }],
      [{ id: BRASIL, fieldPresets: BRASIL_PRESETS }],
    );
    const [achado] = fieldPresetFindings(dte('cpf-cnpj'), read);
    expect(achado.status).toBe('ok');
    expect(achado.detail).toContain(`plugin.ts of ${BRASIL}`);
  });

  it('aceita a chave certa da dependência', () => {
    const [achado] = fieldPresetFindings(dte('cpfCnpj'), leitura([], [{ id: BRASIL, fieldPresets: BRASIL_PRESETS }]));
    expect(achado.status).toBe('ok');
  });

  it('a dependência que não está à vista é aviso, e o retrato de um Console antigo é dito', () => {
    const [sem] = fieldPresetFindings(dte('cpf-cnpj'), leitura([], null));
    expect(sem.status).toBe('unverifiable');
    expect(sem.detail).toContain('there is none here');

    const [antigo] = fieldPresetFindings(dte('cpf-cnpj'), leitura([], [{ id: BRASIL }]));
    expect(antigo.status).toBe('unverifiable');
    expect(antigo.detail).toContain('older than that field');
  });

  it('a chave de uma extensão que o pacote não declara é aviso, pedindo a dependência', () => {
    const [achado] = fieldPresetFindings(dte('cpf', {}), leitura([], [{ id: BRASIL, fieldPresets: BRASIL_PRESETS }]));
    expect(achado.status).toBe('undeclared');
    expect(achado.detail).toContain('Declare the dependency');
  });

  it('o pacote sem dependência e sem retrato é aviso, nunca recusa', () => {
    const [achado] = fieldPresetFindings(dte('cpf', {}), leitura([], null));
    expect(achado.status).toBe('unverifiable');
    expect(achado.detail).toContain('declares no dependency');
  });

  it('o que o kernel e o próprio pacote respondem não entra aqui, nem lê o diretório', () => {
    expect(fieldPresetReport(dte('digits', {}), '/caminho/que/nao/existe')).toEqual([]);
  });
});
