import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import {
  INSTALLED_CATALOG_FILE,
  INSTALLED_CATALOG_STALE_DAYS,
  INSTALLED_CATALOG_VERSION,
  installedScreenInput,
  readInstalledCatalog,
} from './installedCatalog';

/**
 * O RETRATO é opcional, e as duas metades disso são iguais em importância: sem arquivo, nada muda; com
 * arquivo que não dá para acreditar, ele é RECUSADO com o motivo em vez de entrar pela metade.
 *
 * Meio catálogo é o pior dos três estados possíveis — ele parece completo.
 */

const TAKEN_AT = new Date('2026-08-01T12:00:00.000Z');

const snapshot = (overrides: Record<string, unknown> = {}): string => JSON.stringify({
  version: INSTALLED_CATALOG_VERSION,
  projectId: 'office-prod',
  tenantId: 'tenant-1',
  tenantName: 'Escritório Central',
  exportedAt: TAKEN_AT.toISOString(),
  kernelVersion: KERNEL_VERSION,
  consoleVersion: '2.10.0',
  extensions: [{ id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true }],
  screens: [
    {
      key: 'customers',
      titleSingular: 'Customer',
      titlePlural: 'Customers',
      titleFieldKey: 'name',
      origin: 'design',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'design' },
        { key: 'email', label: 'E-mail', type: 'text', required: false, order: 1, origin: 'design' },
      ],
    },
  ],
  lookups: [{ collection: 'customerSegments', label: 'Segments' }],
  tagLists: [],
  ...overrides,
}, null, 2);

const workspace = mkdtempSync(join(tmpdir(), 'microteia-snapshot-'));
const write = (contents: string): void => writeFileSync(join(workspace, INSTALLED_CATALOG_FILE), contents);

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('o retrato da instalação', () => {
  it('ausente é o caso normal, e não um problema', () => {
    const empty = mkdtempSync(join(tmpdir(), 'microteia-snapshot-none-'));
    const read = readInstalledCatalog(empty);
    expect(read.present).toBe(false);
    expect(read.snapshot).toBeNull();
    expect(read.problems).toEqual([]);
    rmSync(empty, { recursive: true, force: true });
  });

  it('lê projeto, escritório, quando foi tirado e por qual kernel', () => {
    write(snapshot());
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.snapshot?.projectId).toBe('office-prod');
    expect(read.snapshot?.tenantName).toBe('Escritório Central');
    expect(read.snapshot?.screens[0].fields).toHaveLength(2);
    expect(read.ageDays).toBe(0);
    expect(read.stale).toBe(false);
    expect(read.kernelDiffers).toBe(false);
    expect(read.problems).toEqual([]);
  });

  it('velho continua valendo, e é anunciado como velho', () => {
    write(snapshot());
    const later = new Date(TAKEN_AT.getTime() + (INSTALLED_CATALOG_STALE_DAYS + 3) * 86_400_000);
    const read = readInstalledCatalog(workspace, later);
    expect(read.ageDays).toBe(INSTALLED_CATALOG_STALE_DAYS + 3);
    expect(read.stale).toBe(true);
    expect(read.snapshot?.screens).toHaveLength(1);
  });

  it('tirado por outro contrato de kernel é lido, e a diferença é dita', () => {
    write(snapshot({ kernelVersion: '0.0.1-from-another-era' }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.kernelDiffers).toBe(true);
    expect(read.snapshot).not.toBeNull();
  });

  /** Formato de outra época NÃO é lido pela metade: seria um catálogo incompleto passando por completo. */
  it('de outro FORMATO é recusado, com o comando que o refaz', () => {
    write(snapshot({ version: 99 }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.snapshot).toBeNull();
    expect(read.problems[0]).toContain('export-catalog');
  });

  it('sem projeto e escritório é recusado — não é retrato de nada', () => {
    write(snapshot({ projectId: '', tenantId: '' }));
    expect(readInstalledCatalog(workspace, TAKEN_AT).snapshot).toBeNull();
  });

  it('ilegível é recusado, e o motivo diz o que fazer', () => {
    write('{ not json');
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.present).toBe(true);
    expect(read.snapshot).toBeNull();
    expect(read.problems[0]).toContain('export-catalog');
  });

  it('sem data legível é lido, e quem lê fica sabendo que não há como saber a idade', () => {
    write(snapshot({ exportedAt: 'ontem' }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.snapshot).not.toBeNull();
    expect(read.ageDays).toBeNull();
    expect(read.problems[0]).toContain('exportedAt');
  });

  it('uma tela dele vira a mesma forma de uma tela de plugin.ts, marcada como da instalação', () => {
    write(snapshot());
    const screen = readInstalledCatalog(workspace, TAKEN_AT).snapshot?.screens[0];
    const input = installedScreenInput(screen!);
    expect(input.source).toBe('installation');
    expect(input.key).toBe('customers');
    expect(input.fields[0]).toMatchObject({ key: 'name', type: 'text', required: true, origin: 'design' });
  });
});

/**
 * O nome que não se enxerga é o nome que não se escreve: sem a superfície exportada, quem autora fora
 * do escritório sabia que a extensão está instalada e não tinha como descobrir o que referenciar dela.
 */
describe('a superfície que se pode referenciar', () => {
  const billing = (exports: unknown): Record<string, unknown> => ({
    id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true, ...(exports === undefined ? {} : { exports }),
  });

  it('traz cada export com o tipo e o nome, que é o que decide onde a referência cabe', () => {
    write(snapshot({
      extensions: [billing([
        { id: 'normalize-tax-id', kind: 'script', name: 'Normalize tax id' },
        { id: 'notify-customer', kind: 'workflow', name: 'Notify the customer' },
      ])],
    }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.exportsKnown).toBe(true);
    expect(read.snapshot?.extensions[0].exports).toEqual([
      { id: 'normalize-tax-id', kind: 'script', name: 'Normalize tax id' },
      { id: 'notify-customer', kind: 'workflow', name: 'Notify the customer' },
    ]);
  });

  /** A lista PRESENTE e vazia é a resposta "não exporta nada" — e é uma resposta, não silêncio. */
  it('lista vazia é uma afirmação, e continua sendo conhecida', () => {
    write(snapshot({ extensions: [billing([])] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.exportsKnown).toBe(true);
    expect(read.snapshot?.extensions[0].exports).toEqual([]);
  });

  it('chave AUSENTE é silêncio de um Console antigo, e o retrato não a lê como ausência', () => {
    write(snapshot({ extensions: [billing(undefined)] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.exportsKnown).toBe(false);
    expect(read.snapshot?.extensions[0].exports).toBeUndefined();
  });

  it('basta UMA extensão sem a chave para a superfície inteira deixar de ser confiável', () => {
    write(snapshot({ extensions: [billing([]), { id: 'com.example.crm', name: 'CRM', version: '1.0.0', active: true }] }));
    expect(readInstalledCatalog(workspace, TAKEN_AT).exportsKnown).toBe(false);
  });

  it('sem extensão nenhuma não há o que ignorar — a superfície é conhecida e vazia', () => {
    write(snapshot({ extensions: [] }));
    expect(readInstalledCatalog(workspace, TAKEN_AT).exportsKnown).toBe(true);
  });

  it('tipo que este kernel não conhece vira "unknown" em vez de derrubar o retrato', () => {
    write(snapshot({ extensions: [billing([{ id: 'x', kind: 'gadget', name: 'X' }])] }));
    expect(readInstalledCatalog(workspace, TAKEN_AT).snapshot?.extensions[0].exports)
      .toEqual([{ id: 'x', kind: 'unknown', name: 'X' }]);
  });
});

describe('os grupos da barra lateral do retrato', () => {
  const calendar = (navGroups: unknown): Record<string, unknown> => ({
    id: 'com.microteia.calendar', name: 'Calendar', version: '1.0.0', active: true, exports: [],
    ...(navGroups === undefined ? {} : { navGroups }),
  });

  it('traz a chave, o nome em cada idioma e a ordem', () => {
    write(snapshot({
      extensions: [calendar([{ key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20 }])],
    }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.navGroupsKnown).toBe(true);
    expect(read.snapshot?.extensions[0].navGroups).toEqual([
      { key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20 },
    ]);
  });

  it('chave AUSENTE é silêncio de um Console antigo, e os grupos deixam de ser conhecidos', () => {
    write(snapshot({ extensions: [calendar(undefined)] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.navGroupsKnown).toBe(false);
    expect(read.snapshot?.extensions[0].navGroups).toBeUndefined();
  });
});

describe('os presets de campo do retrato', () => {
  const brasil = (fieldPresets: unknown): Record<string, unknown> => ({
    id: 'com.microteia.brasil', name: 'Brasil', version: '1.2.1', active: true, exports: [], navGroups: [], documentTemplates: [],
    ...(fieldPresets === undefined ? {} : { fieldPresets }),
  });

  it('traz a chave e as partes, e descarta a parte que não conhece', () => {
    write(snapshot({ extensions: [brasil([{ key: 'cpfCnpj', slots: ['mask', 'validate', 'teleporte'] }, { slots: ['mask'] }])] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.fieldPresetsKnown).toBe(true);
    expect(read.snapshot?.extensions[0].fieldPresets).toEqual([{ key: 'cpfCnpj', slots: ['mask', 'validate'] }]);
  });

  it('chave AUSENTE é silêncio de um Console antigo, e os presets deixam de ser conhecidos', () => {
    write(snapshot({ extensions: [brasil(undefined)] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.fieldPresetsKnown).toBe(false);
    expect(read.snapshot?.extensions[0].fieldPresets).toBeUndefined();
  });
});

describe('os modelos de documento do retrato', () => {
  const contratos = (documentTemplates: unknown): Record<string, unknown> => ({
    id: 'com.example.docs', name: 'Docs', version: '1.0.0', active: true, exports: [], navGroups: [],
    ...(documentTemplates === undefined ? {} : { documentTemplates }),
  });

  it('traz a chave, a origem e a forma dos parâmetros', () => {
    write(snapshot({
      extensions: [contratos([{
        key: 'procuracao',
        source: 'payload',
        parameters: [{ key: 'outorgante', type: 'EntityReference', entityType: 'pessoas', required: true }],
      }])],
    }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.documentTemplatesKnown).toBe(true);
    expect(read.snapshot?.extensions[0].documentTemplates).toEqual([{
      key: 'procuracao',
      source: 'payload',
      parameters: [{ key: 'outorgante', type: 'EntityReference', entityType: 'pessoas', required: true }],
    }]);
  });

  it('chave AUSENTE é silêncio de um Console antigo, e os modelos deixam de ser conhecidos', () => {
    write(snapshot({ extensions: [contratos(undefined)] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.documentTemplatesKnown).toBe(false);
    expect(read.snapshot?.extensions[0].documentTemplates).toBeUndefined();
  });
});

/**
 * As chaves atravessam como esquema. A ausente é o silêncio de um Console antigo e a vazia é resposta —
 * a mesma distinção de `exports`, porque "nenhuma chave" é uma afirmação que um retrato velho não fez.
 */
describe('as chaves das telas', () => {
  const customers = (extra: Record<string, unknown>, unique = false): Record<string, unknown> => ({
    key: 'customers',
    titleSingular: 'Customer',
    titleFieldKey: 'name',
    origin: 'design',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'design' },
      { key: 'email', label: 'E-mail', type: 'text', required: false, order: 1, origin: 'design', ...(unique ? { unique: true } : {}) },
    ],
    ...extra,
  });

  const KEY = {
    name: 'customer-name',
    kind: 'unique',
    fields: ['name'],
    scope: 'tenant',
    normalize: { trim: true, caseInsensitive: true, formatPreset: 'digits' },
    sparse: false,
    ownerPluginId: 'com.example.billing',
  };

  it('a chave viaja inteira, e a tela a carrega para o catálogo', () => {
    write(snapshot({ screens: [customers({ keys: [KEY] }, true)] }));
    const read = readInstalledCatalog(workspace, TAKEN_AT);
    expect(read.keysKnown).toBe(true);
    expect(read.snapshot?.screens[0].keys).toStrictEqual([KEY]);

    const input = installedScreenInput(read.snapshot!.screens[0]);
    expect(input.keys).toStrictEqual([KEY]);
    expect(input.fields[1].unique).toBe(true);
    expect(input.fields[0].unique).toBeUndefined();
  });

  it('a lista vazia é resposta; a chave ausente é desconhecida', () => {
    write(snapshot({ screens: [customers({ keys: [] })] }));
    const empty = readInstalledCatalog(workspace, TAKEN_AT);
    expect(empty.keysKnown).toBe(true);
    expect(empty.snapshot?.screens[0].keys).toStrictEqual([]);

    write(snapshot({ screens: [customers({})] }));
    const silent = readInstalledCatalog(workspace, TAKEN_AT);
    expect(silent.keysKnown).toBe(false);
    expect(silent.snapshot?.screens[0].keys).toBeUndefined();
    expect('keys' in installedScreenInput(silent.snapshot!.screens[0])).toBe(false);
  });

  it('a chave que o kernel não reconheceria fica de fora — e o que é desconhecido nela também', () => {
    write(snapshot({
      screens: [customers({
        keys: [
          { name: 'no-fields', kind: 'unique', fields: [] },
          { name: '', kind: 'unique', fields: ['name'] },
          { name: 'other-kind', kind: 'index', fields: ['name'] },
          { name: 'kept', kind: 'primary', fields: ['name', 42], scope: 'galaxy', normalize: { nothing: true }, message: '@x/y' },
        ],
      })],
    }));
    expect(readInstalledCatalog(workspace, TAKEN_AT).snapshot?.screens[0].keys).toStrictEqual([
      { name: 'kept', kind: 'primary', fields: ['name'] },
    ]);
  });
});
