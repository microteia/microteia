import { describe, expect, it } from 'vitest';
import { validatePluginPackage } from './validate';
import { buildPackage } from '../domain/usecases/plugins/packageBuilder';
import { serializePackage, parsePackage } from '../domain/usecases/plugins/packageSerialization';
import { buildScreenKeyMap, materializeScreen } from '../domain/usecases/plugins/screenModule';
import type { ScreenDefinition } from '../domain/entities';

/**
 * Uma propriedade de tela só existe para o escritório se atravessar o ciclo inteiro: a tela viva vira
 * template no empacotamento, o pacote passa pela porta de validação, e a instalação a materializa de
 * volta. Cada passo copia propriedade por propriedade, e a que um deles esquece some calada.
 */
const now = new Date('2026-10-10T00:00:00Z');

const intimacoes: ScreenDefinition = {
  id: 'intimacoes', tenantId: 't1', origin: 'design',
  titleSingular: 'Intimação', titlePlural: 'Intimações', icon: 'mail',
  fields: [{ key: 'titulo', label: 'Título', type: 'text', required: true, order: 0, origin: 'design' }],
  titleFieldKey: 'titulo', hasNotes: false, hasDocuments: false, hasTags: false,
  listActions: [], viewActionIds: [], cardActionIds: [],
  ownerPluginId: null, managed: null, sidebarOrder: 0, enabled: true,
  hideRecordsFromCommandPalette: true,
  createdAt: now, createdBy: 'u1', updatedAt: now,
};

const roundTrip = (screen: ScreenDefinition) => {
  const pkg = buildPackage({
    manifest: { id: 'com.example.ingest', version: '1.0.0', kernel: '^2.25.0', name: 'Ingest' },
    summary: 'Coleção enchida por ingestão automática.',
    screens: [screen], actions: [], workflows: [], scripts: [],
  });
  const parsed = parsePackage(serializePackage(pkg));
  if (!parsed.ok) throw new Error('o pacote serializado não voltou');
  const templates = parsed.package.screens ?? [];
  const { input } = materializeScreen(templates[0], 'com.example.ingest', buildScreenKeyMap(templates), 'u1');
  return { issues: validatePluginPackage(parsed.package), template: templates[0], input };
};

describe('hideRecordsFromCommandPalette atravessa build → validate → install', () => {
  it('declarada, chega ao template, passa na validação e chega à tela instalada', () => {
    const { issues, template, input } = roundTrip(intimacoes);
    expect(issues).toEqual([]);
    expect(template.hideRecordsFromCommandPalette).toBe(true);
    expect(input.hideRecordsFromCommandPalette).toBe(true);
  });

  it('ausente, não aparece no pacote e a tela instalada se comporta como antes', () => {
    const { template, input } = roundTrip({ ...intimacoes, hideRecordsFromCommandPalette: null });
    expect('hideRecordsFromCommandPalette' in template).toBe(false);
    expect(input.hideRecordsFromCommandPalette).toBe(false);
  });
});
