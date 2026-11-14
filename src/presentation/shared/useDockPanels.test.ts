import { describe, expect, it } from 'vitest';
import type { SurfaceSlotDescriptor } from './settings/useSettingsCatalog';
import { filterVisibleSlots } from './useDockPanels';

const slot = (key: string, extra: Partial<SurfaceSlotDescriptor> = {}): SurfaceSlotDescriptor =>
  ({ surface: 'dock.right', key, title: key, pluginId: 'p', ...extra });

const byKey = new Map([
  ['plain', slot('plain')],
  ['guarded', slot('guarded', { requiredPermissions: ['assistant.use'] })],
  ['gated', slot('gated', { requiresFunction: 'assistantChat' })],
]);
const all = [...byKey.keys()].map((key) => ({ key, enabled: true }));

describe('filterVisibleSlots', () => {
  it('segue a ordem da configuração e tira o desligado', () => {
    const entries = [{ key: 'gated', enabled: true }, { key: 'plain', enabled: false }, { key: 'guarded', enabled: true }];
    expect(filterVisibleSlots(entries, byKey, () => true, () => true).map((one) => one.key)).toEqual(['gated', 'guarded']);
  });

  it('sem autorização (tela de entrada), o que pede permissão não aparece', () => {
    expect(filterVisibleSlots(all, byKey, null, () => true).map((one) => one.key)).toEqual(['plain', 'gated']);
  });

  it('requiresFunction esconde o trecho enquanto a function não está no ar', () => {
    const ready = (name: string | undefined) => !name;
    expect(filterVisibleSlots(all, byKey, () => true, ready).map((one) => one.key)).toEqual(['plain', 'guarded']);
  });
});
