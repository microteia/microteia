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

describe('cardTemplate atravessa build → validate → install', () => {
  const comCartao: ScreenDefinition = {
    ...intimacoes,
    hideRecordsFromCommandPalette: null,
    cardTemplate: {
      layout: 'list',
      accent: { field: 'situacao' },
      body: [
        { type: 'row', justify: 'between', children: [{ type: 'title' }, { type: 'field', field: 'situacao', variant: 'badge' }] },
        { type: 'actions', include: ['copyLink'] },
      ],
    },
    fields: [
      ...intimacoes.fields,
      { key: 'situacao', label: 'Situação', type: 'select', required: false, order: 1, origin: 'design', options: [{ key: 'nova', label: 'Nova' }] },
    ],
  };

  it('declarado, chega ao template intacto, passa na validação e chega à tela instalada', () => {
    const { issues, template, input } = roundTrip(comCartao);
    expect(issues).toEqual([]);
    expect(template.cardTemplate).toEqual(comCartao.cardTemplate);
    expect(input.cardTemplate).toEqual(comCartao.cardTemplate);
  });

  it('ausente, não aparece no pacote e a tela instalada fica com o cartão padrão', () => {
    const { template, input } = roundTrip({ ...comCartao, cardTemplate: null });
    expect('cardTemplate' in template).toBe(false);
    expect(input.cardTemplate).toBeNull();
  });

  it('o portão do pacote recusa campo que a tela não tem, com o caminho dentro da tela', () => {
    const { issues } = roundTrip({ ...comCartao, cardTemplate: { body: [{ type: 'field', field: 'inexistente' }] } });
    expect(issues).toContainEqual(expect.objectContaining({
      message: '@core.records/card-template.issue.field-unknown',
      messageParams: expect.objectContaining({ where: 'screens[0].cardTemplate.body[0].field', field: 'inexistente' }),
    }));
  });
});
